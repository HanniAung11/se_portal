from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
import sqlite3
import json
import hashlib
import bcrypt
import traceback

# ============================================
# CONFIGURATION
# ============================================

SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

app = FastAPI(title=" Booking System API")

# Global exception handler to ensure JSON responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions and return JSON responses"""
    print(f"Error: {type(exc).__name__}: {str(exc)}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": type(exc).__name__
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)}
    )

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",  # Alternative dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"  # Allow all for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ============================================
# DATABASE SETUP
# ============================================

def get_db():
    conn = sqlite3.connect("portal.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table - Updated with role and profile_photo
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'student' CHECK(role IN ('student', 'admin')),
            year INTEGER NOT NULL,
            profile_photo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Add role and email columns if they don't exist (for existing databases)
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN profile_photo TEXT")
    except sqlite3.OperationalError:
        pass
    
    # Courses table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            credits INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Course Registrations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            semester TEXT NOT NULL,
            year INTEGER NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (course_id) REFERENCES courses(id),
            UNIQUE(student_id, course_id, semester, year)
        )
    """)
    
    # Grades table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            grade TEXT NOT NULL,
            semester TEXT NOT NULL,
            year INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (course_id) REFERENCES courses(id),
            UNIQUE(student_id, course_id, semester, year)
        )
    """)
    
    # Notifications table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # Announcements table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES users(id)
        )
    """)
    
    # Bookings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            room_key TEXT NOT NULL,
            room_name TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # Chat messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            sender_name TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            date TEXT NOT NULL
        )
    """)
    
    # Course chatrooms table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_chatrooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            room_key TEXT UNIQUE NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    """)
    
    # Course chatroom members table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_chatroom_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES course_chatrooms(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(room_id, user_id)
        )
    """)
    
    # Attendance sessions table (created by admin)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            course_code TEXT NOT NULL,
            course_title TEXT NOT NULL,
            session_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    """)
    
    # Attendance records table (student check-ins)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            student_student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id),
            UNIQUE(session_id, student_id)
        )
    """)
    
    # Events table (created by admin)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_name TEXT NOT NULL,
            event_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    """)
    
    # Event attendance records table (student attendances)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            student_student_id TEXT NOT NULL,
            student_name TEXT NOT NULL,
            attended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES users(id),
            UNIQUE(event_id, student_id)
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# ============================================
# PYDANTIC MODELS
# ============================================

class UserSignup(BaseModel):
    student_id: str
    name: str
    password: str
    year: int

class UserLogin(BaseModel):
    student_id: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    student_id: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    student_id: str
    name: str
    email: Optional[str] = None
    role: str = "student"
    year: int
    profile_photo: Optional[str] = None

class BookingCreate(BaseModel):
    room_key: str
    room_name: str
    booking_date: str
    time_slot: str

class BookingResponse(BaseModel):
    id: int
    room_key: str
    room_name: str
    booking_date: str
    time_slot: str
    student_name: str
    student_id: str
    created_at: str

class ChatMessage(BaseModel):
    room: str
    content: str

class ChatMessageResponse(BaseModel):
    id: int
    room: str
    sender_name: str
    sender_id: str
    content: str
    timestamp: int
    date: str

# New models for University System
class CourseCreate(BaseModel):
    code: str
    title: str
    credits: int

class CourseResponse(BaseModel):
    id: int
    code: str
    title: str
    credits: int

class CourseRegistrationCreate(BaseModel):
    course_ids: List[int]
    semester: str
    year: int

class CourseRegistrationResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_student_id: str
    course_id: int
    course_code: str
    course_title: str
    course_credits: int
    semester: str
    year: int
    status: str
    created_at: str

class GradeCreate(BaseModel):
    student_id: int
    course_id: int
    grade: str
    semester: str
    year: int

class GradeResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_student_id: Optional[str] = None  # The actual student ID string from users table
    course_id: int
    course_code: str
    course_title: str
    course_credits: int
    grade: str
    semester: str
    year: int

class TranscriptResponse(BaseModel):
    student_id: int
    student_name: str
    student_student_id: str
    courses: List[dict]
    total_credits: int
    earned_credits: int
    gpa: float

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: str

class AnnouncementCreate(BaseModel):
    title: str
    content: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    year: Optional[int] = None

class AnnouncementResponse(BaseModel):
    id: int
    admin_id: int
    admin_name: str
    title: str
    content: str
    created_at: str

class DashboardStats(BaseModel):
    total_students: int
    pending_registrations: int
    approved_courses: int
    total_courses: int
    students_with_grades: int

class BookingStats(BaseModel):
    daily: List[dict]
    weekly: List[dict]
    monthly: List[dict]
    most_booked_rooms: List[dict]

class ChatStats(BaseModel):
    total_messages: int
    messages_by_room: List[dict]
    messages_by_date: List[dict]

class GPAStats(BaseModel):
    average_gpa: float
    gpa_distribution: List[dict]
    students_with_gpa: int

class CreditUsageStats(BaseModel):
    total_credits: int
    credits_by_semester: List[dict]
    average_credits_per_student: float

class UserActivityStats(BaseModel):
    new_users_by_date: List[dict]
    total_active_users: int

# ============================================
# AUTHENTICATION HELPERS
# ============================================


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user_by_student_id(student_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE student_id = ?", (student_id,))
    user = cursor.fetchone()
    conn.close()
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        student_id: str = payload.get("sub")
        if student_id is None:
            raise credentials_exception
        token_data = TokenData(student_id=student_id)
    except JWTError:
        raise credentials_exception
    
    user = get_user_by_student_id(student_id=token_data.student_id)
    if user is None:
        raise credentials_exception
    return user

async def get_current_admin(current_user = Depends(get_current_user)):
    role = current_user["role"] if "role" in current_user.keys() else "student"
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.post("/signup", response_model=UserResponse)
async def signup(user: UserSignup):
    # Validate year
    if user.year not in [1, 2, 3, 4]:
        raise HTTPException(status_code=400, detail="Year must be 1, 2, 3, or 4")
    
    # Check if user already exists
    existing_user = get_user_by_student_id(user.student_id)
    if existing_user:
        raise HTTPException(status_code=400, detail="Student ID already registered")
    
    # Create new user
    conn = get_db()
    cursor = conn.cursor()
    hashed_password = get_password_hash(user.password)
    
    try:
        cursor.execute(
            "INSERT INTO users (student_id, name, password_hash, year) VALUES (?, ?, ?, ?)",
            (user.student_id, user.name, hashed_password, user.year)
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Student ID already exists")
    
    conn.close()
    
    return UserResponse(
        id=user_id,
        student_id=user.student_id,
        name=user.name,
        year=user.year
    )

@app.post("/login", response_model=Token)
async def login(user: UserLogin):
    try:
        db_user = get_user_by_student_id(user.student_id)
        
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect student ID or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not verify_password(user.password, db_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect student ID or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user["student_id"]}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {type(e).__name__}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@app.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        student_id=current_user["student_id"],
        name=current_user["name"],
        email=current_user["email"] if "email" in current_user.keys() else None,
        role=current_user["role"] if "role" in current_user.keys() else "student",
        year=current_user["year"],
        profile_photo=current_user["profile_photo"] if "profile_photo" in current_user.keys() else None
    )

# ============================================
# BOOKING ENDPOINTS
# ============================================

@app.post("/bookings", response_model=BookingResponse)
async def create_booking(booking: BookingCreate, current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if slot is already booked
    cursor.execute(
        "SELECT * FROM bookings WHERE room_key = ? AND booking_date = ? AND time_slot = ?",
        (booking.room_key, booking.booking_date, booking.time_slot)
    )
    existing = cursor.fetchone()
    
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="This time slot is already booked")
    
    # Check booking limit (max 2 per category per user)
    cursor.execute(
        "SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND room_key = ?",
        (current_user["id"], booking.room_key)
    )
    count_result = cursor.fetchone()
    
    if count_result["count"] >= 2:
        conn.close()
        raise HTTPException(status_code=400, detail="You can't book more than 2 times in the same category")
    
    # Create booking
    cursor.execute(
        """INSERT INTO bookings (user_id, room_key, room_name, booking_date, time_slot) 
           VALUES (?, ?, ?, ?, ?)""",
        (current_user["id"], booking.room_key, booking.room_name, booking.booking_date, booking.time_slot)
    )
    conn.commit()
    booking_id = cursor.lastrowid
    
    # Get created booking
    cursor.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,))
    new_booking = cursor.fetchone()
    conn.close()
    
    return BookingResponse(
        id=new_booking["id"],
        room_key=new_booking["room_key"],
        room_name=new_booking["room_name"],
        booking_date=new_booking["booking_date"],
        time_slot=new_booking["time_slot"],
        student_name=current_user["name"],
        student_id=current_user["student_id"],
        created_at=new_booking["created_at"]
    )

@app.get("/bookings", response_model=List[BookingResponse])
async def get_user_bookings(current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT b.*, u.name, u.student_id 
           FROM bookings b 
           JOIN users u ON b.user_id = u.id 
           WHERE b.user_id = ?
           ORDER BY b.booking_date, b.time_slot""",
        (current_user["id"],)
    )
    bookings = cursor.fetchall()
    conn.close()
    
    return [
        BookingResponse(
            id=b["id"],
            room_key=b["room_key"],
            room_name=b["room_name"],
            booking_date=b["booking_date"],
            time_slot=b["time_slot"],
            student_name=b["name"],
            student_id=b["student_id"],
            created_at=b["created_at"]
        )
        for b in bookings
    ]

@app.get("/bookings/check")
async def check_slot_availability(
    room_key: str,
    booking_date: str,
    current_user = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT time_slot FROM bookings WHERE room_key = ? AND booking_date = ?",
        (room_key, booking_date)
    )
    booked_slots = [row["time_slot"] for row in cursor.fetchall()]
    conn.close()
    
    return {"booked_slots": booked_slots}

@app.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: int, current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if booking exists and belongs to user
    cursor.execute(
        "SELECT * FROM bookings WHERE id = ? AND user_id = ?",
        (booking_id, current_user["id"])
    )
    booking = cursor.fetchone()
    
    if not booking:
        conn.close()
        raise HTTPException(status_code=404, detail="Booking not found or unauthorized")
    
    cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
    conn.commit()
    conn.close()
    
    return {"message": "Booking cancelled successfully"}

# ============================================
# CHAT ENDPOINTS
# ============================================

@app.get("/chat/rooms")
async def get_available_rooms(current_user = Depends(get_current_user)):
    # Return only the room for the user's year
    year = current_user["year"]
    
    rooms = {
        1: {"key": "year1", "name": "Year 1 Group Chat", "avatar": "1️⃣"},
        2: {"key": "year2", "name": "Year 2 Group Chat", "avatar": "2️⃣"},
        3: {"key": "year3", "name": "Year 3 Group Chat", "avatar": "3️⃣"},
        4: {"key": "year4", "name": "Year 4 Group Chat", "avatar": "4️⃣"}
    }
    
    return {"room": rooms[year]}

@app.get("/chat/messages/{room}")
async def get_chat_messages(room: str, current_user = Depends(get_current_user)):
    # Verify user has access to this room
    year_rooms = {
        1: "year1",
        2: "year2",
        3: "year3",
        4: "year4"
    }
    
    if room != year_rooms[current_user["year"]]:
        raise HTTPException(status_code=403, detail="Access denied to this chat room")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM chat_messages WHERE room = ? ORDER BY timestamp",
        (room,)
    )
    messages = cursor.fetchall()
    conn.close()
    
    return {
        "messages": [
            ChatMessageResponse(
                id=msg["id"],
                room=msg["room"],
                sender_name=msg["sender_name"],
                sender_id=msg["sender_id"],
                content=msg["content"],
                timestamp=msg["timestamp"],
                date=msg["date"]
            )
            for msg in messages
        ]
    }

@app.post("/chat/messages")
async def send_chat_message(message: ChatMessage, current_user = Depends(get_current_user)):
    # Verify user has access to this room
    year_rooms = {
        1: "year1",
        2: "year2",
        3: "year3",
        4: "year4"
    }
    
    if message.room != year_rooms[current_user["year"]]:
        raise HTTPException(status_code=403, detail="Access denied to this chat room")
    
    timestamp = int(datetime.now().timestamp() * 1000)
    date = datetime.now().strftime("%Y-%m-%d")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO chat_messages (room, user_id, sender_name, sender_id, content, timestamp, date)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (message.room, current_user["id"], current_user["name"], current_user["student_id"], 
         message.content, timestamp, date)
    )
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()
    
    return ChatMessageResponse(
        id=message_id,
        room=message.room,
        sender_name=current_user["name"],
        sender_id=current_user["student_id"],
        content=message.content,
        timestamp=timestamp,
        date=date
    )

# ============================================
# ADMIN CHAT ENDPOINTS (Admin Only - Access All Year Groups)
# ============================================

@app.get("/admin/chat/rooms")
async def get_admin_chat_rooms(current_user = Depends(get_current_admin)):
    # Return all 4 year rooms for admin
    rooms = {
        1: {"key": "year1", "name": "Year 1 Group Chat", "avatar": "1️⃣"},
        2: {"key": "year2", "name": "Year 2 Group Chat", "avatar": "2️⃣"},
        3: {"key": "year3", "name": "Year 3 Group Chat", "avatar": "3️⃣"},
        4: {"key": "year4", "name": "Year 4 Group Chat", "avatar": "4️⃣"}
    }
    
    return {"rooms": list(rooms.values())}

@app.get("/admin/chat/messages/{room}")
async def get_admin_chat_messages(room: str, current_user = Depends(get_current_admin)):
    # Admin can access any room
    valid_rooms = ["year1", "year2", "year3", "year4"]
    
    if room not in valid_rooms:
        raise HTTPException(status_code=400, detail="Invalid room")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM chat_messages WHERE room = ? ORDER BY timestamp",
        (room,)
    )
    messages = cursor.fetchall()
    conn.close()
    
    return {
        "messages": [
            ChatMessageResponse(
                id=msg["id"],
                room=msg["room"],
                sender_name=msg["sender_name"],
                sender_id=msg["sender_id"],
                content=msg["content"],
                timestamp=msg["timestamp"],
                date=msg["date"]
            )
            for msg in messages
        ]
    }

@app.post("/admin/chat/messages")
async def send_admin_chat_message(message: ChatMessage, current_user = Depends(get_current_admin)):
    # Admin can send messages to any room
    valid_rooms = ["year1", "year2", "year3", "year4"]
    
    if message.room not in valid_rooms:
        raise HTTPException(status_code=400, detail="Invalid room")
    
    timestamp = int(datetime.now().timestamp() * 1000)
    date = datetime.now().strftime("%Y-%m-%d")
    
    # Use admin name and ID for sender info
    # sqlite3.Row objects support dictionary access but not .get()
    try:
        admin_name = current_user["name"]
    except (KeyError, TypeError):
        admin_name = "Administrator"
    
    try:
        admin_id = current_user["id"]
    except (KeyError, TypeError):
        admin_id = None
    
    try:
        student_id = current_user["student_id"]
    except (KeyError, TypeError):
        student_id = None
    
    sender_id = student_id or (f"admin_{admin_id}" if admin_id else "admin")
    
    if not admin_id:
        raise HTTPException(status_code=400, detail="Admin ID not found")
    
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO chat_messages (room, user_id, sender_name, sender_id, content, timestamp, date)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (message.room, admin_id, admin_name, sender_id, 
             message.content, timestamp, date)
        )
        conn.commit()
        message_id = cursor.lastrowid
        
        return ChatMessageResponse(
            id=message_id,
            room=message.room,
            sender_name=admin_name,
            sender_id=sender_id,
            content=message.content,
            timestamp=timestamp,
            date=date
        )
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")
    finally:
        if conn:
            conn.close()

# ============================================
# COURSE CHATROOM ENDPOINTS
# ============================================

@app.get("/course-chatrooms")
async def get_course_chatrooms(current_user = Depends(get_current_user)):
    """Get course chatrooms - admin sees all, students see only ones they're members of"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        role = current_user["role"] if "role" in current_user.keys() else "student"
        user_id = current_user["id"]
        
        if role == "admin":
            # Admin sees all course chatrooms
            cursor.execute("""
                SELECT cc.id, cc.course_id, cc.room_key, c.code, c.title, 
                       ccm.role as user_role, cc.created_at
                FROM course_chatrooms cc
                JOIN courses c ON cc.course_id = c.id
                LEFT JOIN course_chatroom_members ccm ON cc.id = ccm.room_id AND ccm.user_id = ?
                ORDER BY c.code
            """, (user_id,))
        else:
            # Students see only chatrooms they're members of
            cursor.execute("""
                SELECT cc.id, cc.course_id, cc.room_key, c.code, c.title, 
                       ccm.role as user_role, cc.created_at
                FROM course_chatrooms cc
                JOIN courses c ON cc.course_id = c.id
                JOIN course_chatroom_members ccm ON cc.id = ccm.room_id
                WHERE ccm.user_id = ?
                ORDER BY c.code
            """, (user_id,))
        
        chatrooms = cursor.fetchall()
        conn.close()
        
        return {
            "chatrooms": [
                {
                    "id": cr["id"],
                    "course_id": cr["course_id"],
                    "room_key": cr["room_key"],
                    "course_code": cr["code"],
                    "course_title": cr["title"],
                    "user_role": cr["user_role"] or "admin",
                    "created_at": cr["created_at"]
                }
                for cr in chatrooms
            ]
        }
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to get chatrooms: {str(e)}")

@app.get("/course-chatrooms/{room_key}/messages")
async def get_course_chat_messages(room_key: str, current_user = Depends(get_current_user)):
    """Get messages from a course chatroom"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        user_id = current_user["id"]
        role = current_user["role"] if "role" in current_user.keys() else "student"
        
        # Verify user has access to this chatroom
        if role == "admin":
            # Admin can access any course chatroom
            cursor.execute("SELECT id FROM course_chatrooms WHERE room_key = ?", (room_key,))
        else:
            # Students must be members
            cursor.execute("""
                SELECT cc.id FROM course_chatrooms cc
                JOIN course_chatroom_members ccm ON cc.id = ccm.room_id
                WHERE cc.room_key = ? AND ccm.user_id = ?
            """, (room_key, user_id))
        
        chatroom = cursor.fetchone()
        if not chatroom:
            conn.close()
            raise HTTPException(status_code=403, detail="Access denied to this chatroom")
        
        # Get messages
        cursor.execute(
            "SELECT * FROM chat_messages WHERE room = ? ORDER BY timestamp",
            (room_key,)
        )
        messages = cursor.fetchall()
        conn.close()
        
        return {
            "messages": [
                ChatMessageResponse(
                    id=msg["id"],
                    room=msg["room"],
                    sender_name=msg["sender_name"],
                    sender_id=msg["sender_id"],
                    content=msg["content"],
                    timestamp=msg["timestamp"],
                    date=msg["date"]
                )
                for msg in messages
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@app.post("/course-chatrooms/{room_key}/messages")
async def send_course_chat_message(room_key: str, message: ChatMessage, current_user = Depends(get_current_user)):
    """Send message to a course chatroom"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        user_id = current_user["id"]
        role = current_user["role"] if "role" in current_user.keys() else "student"
        
        # Verify user has access to this chatroom
        if role == "admin":
            cursor.execute("SELECT id FROM course_chatrooms WHERE room_key = ?", (room_key,))
        else:
            cursor.execute("""
                SELECT cc.id FROM course_chatrooms cc
                JOIN course_chatroom_members ccm ON cc.id = ccm.room_id
                WHERE cc.room_key = ? AND ccm.user_id = ?
            """, (room_key, user_id))
        
        chatroom = cursor.fetchone()
        if not chatroom:
            conn.close()
            raise HTTPException(status_code=403, detail="Access denied to this chatroom")
        
        # Verify room_key matches
        if message.room != room_key:
            conn.close()
            raise HTTPException(status_code=400, detail="Room key mismatch")
        
        timestamp = int(datetime.now().timestamp() * 1000)
        date = datetime.now().strftime("%Y-%m-%d")
        
        # Get sender info
        try:
            sender_name = current_user["name"]
        except (KeyError, TypeError):
            sender_name = "User"
        
        try:
            student_id = current_user["student_id"]
        except (KeyError, TypeError):
            student_id = f"user_{user_id}"
        
        # Insert message
        cursor.execute(
            """INSERT INTO chat_messages (room, user_id, sender_name, sender_id, content, timestamp, date)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (room_key, user_id, sender_name, student_id, message.content, timestamp, date)
        )
        conn.commit()
        message_id = cursor.lastrowid
        
        return ChatMessageResponse(
            id=message_id,
            room=room_key,
            sender_name=sender_name,
            sender_id=student_id,
            content=message.content,
            timestamp=timestamp,
            date=date
        )
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")
    finally:
        if conn:
            conn.close()

@app.delete("/course-chatrooms/{room_key}")
async def delete_course_chatroom(room_key: str, current_user = Depends(get_current_admin)):
    """Delete a course chatroom (admin only)"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Verify chatroom exists
        cursor.execute("SELECT id, course_id FROM course_chatrooms WHERE room_key = ?", (room_key,))
        chatroom = cursor.fetchone()
        if not chatroom:
            conn.close()
            raise HTTPException(status_code=404, detail="Chatroom not found")
        
        # Delete chatroom (cascade will delete members and messages)
        cursor.execute("DELETE FROM course_chatrooms WHERE room_key = ?", (room_key,))
        conn.commit()
        conn.close()
        
        return {"message": "Chatroom deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to delete chatroom: {str(e)}")

# ============================================
# COURSES ENDPOINTS (Admin Only)
# ============================================

@app.post("/courses", response_model=CourseResponse)
async def create_course(course: CourseCreate, current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "INSERT INTO courses (code, title, credits) VALUES (?, ?, ?)",
            (course.code, course.title, course.credits)
        )
        conn.commit()
        course_id = cursor.lastrowid
        
        # Create chatroom for the course
        try:
            admin_id = current_user["id"]
            room_key = f"course_{course_id}"
            cursor.execute(
                "INSERT INTO course_chatrooms (course_id, room_key, created_by) VALUES (?, ?, ?)",
                (course_id, room_key, admin_id)
            )
            conn.commit()
            room_id = cursor.lastrowid
            
            # Add admin as administrator of the chatroom
            cursor.execute(
                "INSERT INTO course_chatroom_members (room_id, user_id, role) VALUES (?, ?, ?)",
                (room_id, admin_id, "admin")
            )
            conn.commit()
        except Exception as e:
            # Log error but don't fail course creation
            print(f"Warning: Failed to create chatroom for course {course_id}: {str(e)}")
        
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Course code already exists")
    
    cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    new_course = cursor.fetchone()
    conn.close()
    
    return CourseResponse(
        id=new_course["id"],
        code=new_course["code"],
        title=new_course["title"],
        credits=new_course["credits"]
    )

@app.get("/courses", response_model=List[CourseResponse])
async def get_courses(current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses ORDER BY code")
    courses = cursor.fetchall()
    conn.close()
    
    return [
        CourseResponse(
            id=c["id"],
            code=c["code"],
            title=c["title"],
            credits=c["credits"]
        )
        for c in courses
    ]

@app.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    course = cursor.fetchone()
    conn.close()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return CourseResponse(
        id=course["id"],
        code=course["code"],
        title=course["title"],
        credits=course["credits"]
    )

@app.put("/courses/{course_id}", response_model=CourseResponse)
async def update_course(course_id: int, course: CourseCreate, current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Course not found")
    
    try:
        cursor.execute(
            "UPDATE courses SET code = ?, title = ?, credits = ? WHERE id = ?",
            (course.code, course.title, course.credits, course_id)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Course code already exists")
    
    cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    updated = cursor.fetchone()
    conn.close()
    
    return CourseResponse(
        id=updated["id"],
        code=updated["code"],
        title=updated["title"],
        credits=updated["credits"]
    )

@app.delete("/courses/{course_id}")
async def delete_course(course_id: int, current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
    course = cursor.fetchone()
    if not course:
        conn.close()
        raise HTTPException(status_code=404, detail="Course not found")
    
    cursor.execute("DELETE FROM courses WHERE id = ?", (course_id,))
    conn.commit()
    conn.close()
    
    return {"message": "Course deleted successfully"}

# ============================================
# COURSE REGISTRATION ENDPOINTS
# ============================================

@app.post("/course-registrations", response_model=List[CourseRegistrationResponse])
async def create_course_registrations(
    registration: CourseRegistrationCreate,
    current_user = Depends(get_current_user)
):
    role = current_user["role"] if "role" in current_user.keys() else "student"
    if role == "admin":
        raise HTTPException(status_code=403, detail="Students only")
    
    conn = get_db()
    cursor = conn.cursor()
    created_registrations = []
    
    for course_id in registration.course_ids:
        # Check if course exists
        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        course = cursor.fetchone()
        if not course:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Course {course_id} not found")
        
        # Check if already registered
        cursor.execute(
            """SELECT * FROM course_registrations 
               WHERE student_id = ? AND course_id = ? AND semester = ? AND year = ?""",
            (current_user["id"], course_id, registration.semester, registration.year)
        )
        existing = cursor.fetchone()
        if existing:
            continue  # Skip if already registered
        
        # Create registration
        cursor.execute(
            """INSERT INTO course_registrations (student_id, course_id, semester, year, status)
               VALUES (?, ?, ?, ?, 'pending')""",
            (current_user["id"], course_id, registration.semester, registration.year)
        )
        conn.commit()
        reg_id = cursor.lastrowid
        
        # Get created registration
        cursor.execute(
            """SELECT cr.*, u.name, u.student_id AS user_student_id, c.code, c.title, c.credits
               FROM course_registrations cr
               JOIN users u ON cr.student_id = u.id
               JOIN courses c ON cr.course_id = c.id
               WHERE cr.id = ?""",
            (reg_id,)
        )
        reg = cursor.fetchone()
        created_registrations.append(reg)
    
    conn.close()
    
    return [
        CourseRegistrationResponse(
            id=r["id"],
            student_id=r["student_id"],
            student_name=r["name"],
            student_student_id=str(r["user_student_id"]),
            course_id=r["course_id"],
            course_code=r["code"],
            course_title=r["title"],
            course_credits=r["credits"],
            semester=r["semester"],
            year=r["year"],
            status=r["status"],
            created_at=r["created_at"]
        )
        for r in created_registrations
    ]

@app.get("/course-registrations", response_model=List[CourseRegistrationResponse])
async def get_course_registrations(
    status: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    
    role = current_user["role"] if "role" in current_user.keys() else "student"
    if role == "admin":
        # Admin sees all registrations
        if status:
            cursor.execute(
                """SELECT cr.*, u.name, u.student_id AS user_student_id, c.code, c.title, c.credits
                   FROM course_registrations cr
                   JOIN users u ON cr.student_id = u.id
                   JOIN courses c ON cr.course_id = c.id
                   WHERE cr.status = ?
                   ORDER BY cr.created_at DESC""",
                (status,)
            )
        else:
            cursor.execute(
                """SELECT cr.*, u.name, u.student_id AS user_student_id, c.code, c.title, c.credits
                   FROM course_registrations cr
                   JOIN users u ON cr.student_id = u.id
                   JOIN courses c ON cr.course_id = c.id
                   ORDER BY cr.created_at DESC"""
            )
    else:
        # Students see only their registrations
        if status:
            cursor.execute(
                """SELECT cr.*, u.name, u.student_id AS user_student_id, c.code, c.title, c.credits
                   FROM course_registrations cr
                   JOIN users u ON cr.student_id = u.id
                   JOIN courses c ON cr.course_id = c.id
                   WHERE cr.student_id = ? AND cr.status = ?
                   ORDER BY cr.created_at DESC""",
                (current_user["id"], status)
            )
        else:
            cursor.execute(
                """SELECT cr.*, u.name, u.student_id AS user_student_id, c.code, c.title, c.credits
                   FROM course_registrations cr
                   JOIN users u ON cr.student_id = u.id
                   JOIN courses c ON cr.course_id = c.id
                   WHERE cr.student_id = ?
                   ORDER BY cr.created_at DESC""",
                (current_user["id"],)
            )
    
    registrations = cursor.fetchall()
    conn.close()
    
    return [
        CourseRegistrationResponse(
            id=r["id"],
            student_id=r["student_id"],
            student_name=r["name"],
            student_student_id=str(r["user_student_id"]),
            course_id=r["course_id"],
            course_code=r["code"],
            course_title=r["title"],
            course_credits=r["credits"],
            semester=r["semester"],
            year=r["year"],
            status=r["status"],
            created_at=r["created_at"]
        )
        for r in registrations
    ]

@app.get("/courses/{course_id}/students", response_model=List[dict])
async def get_course_students(
    course_id: int,
    current_user = Depends(get_current_admin)
):
    """Get all registered students for a specific course with their grades"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get all approved registrations for this course
    cursor.execute(
        """SELECT cr.student_id, u.student_id AS user_student_id, u.name, cr.semester, cr.year
           FROM course_registrations cr
           JOIN users u ON cr.student_id = u.id
           WHERE cr.course_id = ? AND cr.status = 'approved'
           ORDER BY u.student_id""",
        (course_id,)
    )
    registrations = cursor.fetchall()
    
    # Get all grades for this course
    cursor.execute(
        """SELECT g.student_id, g.grade, g.semester, g.year
           FROM grades g
           WHERE g.course_id = ?""",
        (course_id,)
    )
    grades = cursor.fetchall()
    
    # Create a map of student_id -> grade
    grade_map = {}
    for grade in grades:
        key = (grade["student_id"], grade["semester"], grade["year"])
        grade_map[key] = grade["grade"]
    
    # Combine registrations with grades
    result = []
    for reg in registrations:
        key = (reg["student_id"], reg["semester"], reg["year"])
        grade = grade_map.get(key, None)
        result.append({
            "student_id": reg["user_student_id"],
            "student_name": reg["name"],
            "grade": grade,
            "semester": reg["semester"],
            "year": reg["year"]
        })
    
    conn.close()
    return result

@app.patch("/course-registrations/{registration_id}")
async def update_registration_status(
    registration_id: int,
    status: str,
    current_user = Depends(get_current_admin)
):
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM course_registrations WHERE id = ?", (registration_id,))
    registration = cursor.fetchone()
    if not registration:
        conn.close()
        raise HTTPException(status_code=404, detail="Registration not found")
    
    cursor.execute(
        "UPDATE course_registrations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, registration_id)
    )
    conn.commit()
    
    # If approved, add student to course chatroom
    if status == "approved":
        try:
            course_id = registration["course_id"]
            student_id = registration["student_id"]
            
            # Find the course chatroom
            cursor.execute(
                "SELECT id FROM course_chatrooms WHERE course_id = ?",
                (course_id,)
            )
            chatroom = cursor.fetchone()
            
            if chatroom:
                room_id = chatroom["id"]
                # Add student to chatroom (ignore if already exists)
                try:
                    cursor.execute(
                        "INSERT INTO course_chatroom_members (room_id, user_id, role) VALUES (?, ?, ?)",
                        (room_id, student_id, "member")
                    )
                    conn.commit()
                except sqlite3.IntegrityError:
                    # Student already in chatroom, ignore
                    pass
        except Exception as e:
            # Log error but don't fail registration update
            print(f"Warning: Failed to add student to chatroom: {str(e)}")
    
    # Create notification for student
    cursor.execute(
        """INSERT INTO notifications (user_id, type, title, message)
           VALUES (?, ?, ?, ?)""",
        (
            registration["student_id"],
            "registration_update",
            f"Course Registration {status.capitalize()}",
            f"Your registration for course has been {status}."
        )
    )
    conn.commit()
    conn.close()
    
    return {"message": f"Registration {status} successfully"}

# ============================================
# GRADES ENDPOINTS
# ============================================

@app.post("/grades", response_model=GradeResponse)
async def create_grade(grade: GradeCreate, current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify student exists
    cursor.execute("SELECT * FROM users WHERE id = ?", (grade.student_id,))
    student = cursor.fetchone()
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Verify course exists
    cursor.execute("SELECT * FROM courses WHERE id = ?", (grade.course_id,))
    course = cursor.fetchone()
    if not course:
        conn.close()
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Check if registration is approved
    cursor.execute(
        """SELECT * FROM course_registrations 
           WHERE student_id = ? AND course_id = ? AND semester = ? AND year = ? AND status = 'approved'""",
        (grade.student_id, grade.course_id, grade.semester, grade.year)
    )
    registration = cursor.fetchone()
    if not registration:
        conn.close()
        raise HTTPException(status_code=400, detail="Student is not enrolled in this course")
    
    # Check if grade already exists
    cursor.execute(
        """SELECT id FROM grades 
           WHERE student_id = ? AND course_id = ? AND semester = ? AND year = ?""",
        (grade.student_id, grade.course_id, grade.semester, grade.year)
    )
    existing_grade = cursor.fetchone()
    
    if existing_grade:
        # Update existing grade
        cursor.execute(
            """UPDATE grades SET grade = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (grade.grade, existing_grade["id"])
        )
        grade_id = existing_grade["id"]
    else:
        # Insert new grade
        cursor.execute(
            """INSERT INTO grades (student_id, course_id, grade, semester, year)
               VALUES (?, ?, ?, ?, ?)""",
            (grade.student_id, grade.course_id, grade.grade, grade.semester, grade.year)
        )
        grade_id = cursor.lastrowid
    
    conn.commit()
    
    # Get created/updated grade
    cursor.execute(
        """SELECT g.*, u.name, c.code, c.title, c.credits
           FROM grades g
           JOIN users u ON g.student_id = u.id
           JOIN courses c ON g.course_id = c.id
           WHERE g.id = ?""",
        (grade_id,)
    )
    grade_data = cursor.fetchone()
    
    # Create notification for student
    cursor.execute(
        """INSERT INTO notifications (user_id, type, title, message)
           VALUES (?, ?, ?, ?)""",
        (
            grade.student_id,
            "grade_released",
            "Grade Released",
            f"Your grade for {course['code']} has been released: {grade.grade}"
        )
    )
    conn.commit()
    conn.close()
    
    return GradeResponse(
        id=grade_data["id"],
        student_id=grade_data["student_id"],
        student_name=grade_data["name"],
        course_id=grade_data["course_id"],
        course_code=grade_data["code"],
        course_title=grade_data["title"],
        course_credits=grade_data["credits"],
        grade=grade_data["grade"],
        semester=grade_data["semester"],
        year=grade_data["year"]
    )

@app.get("/grades", response_model=List[GradeResponse])
async def get_grades(
    student_id: Optional[int] = None,
    course_id: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    
    role = current_user["role"] if "role" in current_user.keys() else "student"
    if role == "admin":
        # Admin can see all grades or filter
        if student_id and course_id:
            cursor.execute(
                """SELECT g.*, u.name, u.student_id as user_student_id, c.code, c.title, c.credits
                   FROM grades g
                   JOIN users u ON g.student_id = u.id
                   JOIN courses c ON g.course_id = c.id
                   WHERE g.student_id = ? AND g.course_id = ?""",
                (student_id, course_id)
            )
        elif student_id:
            cursor.execute(
                """SELECT g.*, u.name, u.student_id as user_student_id, c.code, c.title, c.credits
                   FROM grades g
                   JOIN users u ON g.student_id = u.id
                   JOIN courses c ON g.course_id = c.id
                   WHERE g.student_id = ?""",
                (student_id,)
            )
        elif course_id:
            cursor.execute(
                """SELECT g.*, u.name, u.student_id as user_student_id, c.code, c.title, c.credits
                   FROM grades g
                   JOIN users u ON g.student_id = u.id
                   JOIN courses c ON g.course_id = c.id
                   WHERE g.course_id = ?
                   ORDER BY u.student_id, g.semester DESC, g.year DESC""",
                (course_id,)
            )
        else:
            cursor.execute(
                """SELECT g.*, u.name, u.student_id as user_student_id, c.code, c.title, c.credits
                   FROM grades g
                   JOIN users u ON g.student_id = u.id
                   JOIN courses c ON g.course_id = c.id
                   ORDER BY g.created_at DESC"""
            )
    else:
        # Students see only their grades
        cursor.execute(
            """SELECT g.*, u.name, c.code, c.title, c.credits
               FROM grades g
               JOIN users u ON g.student_id = u.id
               JOIN courses c ON g.course_id = c.id
               WHERE g.student_id = ?
               ORDER BY g.semester DESC, g.year DESC""",
            (current_user["id"],)
        )
    
    grades = cursor.fetchall()
    conn.close()
    
    return [
        GradeResponse(
            id=g["id"],
            student_id=g["student_id"],  # Keep as integer ID
            student_name=g["name"],
            student_student_id=g.get("user_student_id"),  # The string student ID
            course_id=g["course_id"],
            course_code=g["code"],
            course_title=g["title"],
            course_credits=g["credits"],
            grade=g["grade"],
            semester=g["semester"],
            year=g["year"]
        )
        for g in grades
    ]

# ============================================
# TRANSCRIPT ENDPOINTS
# ============================================

def calculate_gpa(grades_data):
    """Calculate GPA from grades"""
    grade_points = {
        "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5,
        "C": 2.0, "D+": 1.5, "D": 1.0, "F": 0.0
    }
    
    total_points = 0
    total_credits = 0
    
    for grade_data in grades_data:
        grade = grade_data.get("grade", "").upper()
        credits = grade_data.get("credits", 0)
        
        if grade in grade_points:
            total_points += grade_points[grade] * credits
            total_credits += credits
    
    if total_credits == 0:
        return 0.0
    
    return round(total_points / total_credits, 2)

@app.get("/transcript/{student_id}", response_model=TranscriptResponse)
async def get_transcript(
    student_id: int,
    current_user = Depends(get_current_user)
):
    # Students can only see their own transcript
    role = current_user["role"] if "role" in current_user.keys() else "student"
    if role != "admin" and current_user["id"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Get student info
    cursor.execute("SELECT * FROM users WHERE id = ?", (student_id,))
    student = cursor.fetchone()
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Get all grades with course info
    cursor.execute(
        """SELECT g.*, c.code, c.title, c.credits
           FROM grades g
           JOIN courses c ON g.course_id = c.id
           WHERE g.student_id = ?
           ORDER BY g.year DESC, g.semester DESC""",
        (student_id,)
    )
    grades = cursor.fetchall()
    
    # Get all approved registrations (for total credits calculation)
    cursor.execute(
        """SELECT DISTINCT cr.course_id, c.credits
           FROM course_registrations cr
           JOIN courses c ON cr.course_id = c.id
           WHERE cr.student_id = ? AND cr.status = 'approved'""",
        (student_id,)
    )
    all_courses = cursor.fetchall()
    
    total_credits = sum(c["credits"] for c in all_courses)
    earned_credits = sum(g["credits"] for g in grades)
    
    # Calculate GPA
    courses_data = [
        {
            "course_code": g["code"],
            "course_title": g["title"],
            "credits": g["credits"],
            "grade": g["grade"],
            "semester": g["semester"],
            "year": g["year"]
        }
        for g in grades
    ]
    
    gpa = calculate_gpa(courses_data)
    
    conn.close()
    
    return TranscriptResponse(
        student_id=student["id"],
        student_name=student["name"],
        student_student_id=student["student_id"],
        courses=courses_data,
        total_credits=total_credits,
        earned_credits=earned_credits,
        gpa=gpa
    )

@app.get("/transcript", response_model=TranscriptResponse)
async def get_my_transcript(current_user = Depends(get_current_user)):
    return await get_transcript(current_user["id"], current_user)

# ============================================
# NOTIFICATIONS ENDPOINTS
# ============================================

@app.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT * FROM notifications 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT 50""",
        (current_user["id"],)
    )
    notifications = cursor.fetchall()
    conn.close()
    
    return [
        NotificationResponse(
            id=n["id"],
            type=n["type"],
            title=n["title"],
            message=n["message"],
            is_read=bool(n["is_read"]),
            created_at=n["created_at"]
        )
        for n in notifications
    ]

@app.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        (notification_id, current_user["id"])
    )
    conn.commit()
    conn.close()
    
    return {"message": "Notification marked as read"}

@app.get("/notifications/unread-count")
async def get_unread_count(current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
        (current_user["id"],)
    )
    result = cursor.fetchone()
    conn.close()
    
    return {"count": result["count"]}

# ============================================
# ANNOUNCEMENTS ENDPOINTS
# ============================================

@app.post("/announcements", response_model=AnnouncementResponse)
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user = Depends(get_current_admin)
):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT INTO announcements (admin_id, title, content) VALUES (?, ?, ?)",
        (current_user["id"], announcement.title, announcement.content)
    )
    conn.commit()
    announcement_id = cursor.lastrowid
    
    # Create notifications for all students
    cursor.execute("SELECT id FROM users WHERE role = 'student'")
    students = cursor.fetchall()
    for student in students:
        cursor.execute(
            """INSERT INTO notifications (user_id, type, title, message)
               VALUES (?, ?, ?, ?)""",
            (
                student["id"],
                "announcement",
                announcement.title,
                announcement.content[:100] + "..." if len(announcement.content) > 100 else announcement.content
            )
        )
    conn.commit()
    conn.close()
    
    cursor.execute(
        """SELECT a.*, u.name as admin_name
           FROM announcements a
           JOIN users u ON a.admin_id = u.id
           WHERE a.id = ?""",
        (announcement_id,)
    )
    ann = cursor.fetchone()
    conn.close()
    
    return AnnouncementResponse(
        id=ann["id"],
        admin_id=ann["admin_id"],
        admin_name=ann["admin_name"],
        title=ann["title"],
        content=ann["content"],
        created_at=ann["created_at"]
    )

@app.get("/announcements", response_model=List[AnnouncementResponse])
async def get_announcements(current_user = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT a.*, u.name as admin_name
           FROM announcements a
           JOIN users u ON a.admin_id = u.id
           ORDER BY a.created_at DESC
           LIMIT 20"""
    )
    announcements = cursor.fetchall()
    conn.close()
    
    return [
        AnnouncementResponse(
            id=a["id"],
            admin_id=a["admin_id"],
            admin_name=a["admin_name"],
            title=a["title"],
            content=a["content"],
            created_at=a["created_at"]
        )
        for a in announcements
    ]

# ============================================
# DASHBOARD ENDPOINTS
# ============================================

@app.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Total students
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'")
    total_students = cursor.fetchone()["count"]
    
    # Pending registrations
    cursor.execute("SELECT COUNT(*) as count FROM course_registrations WHERE status = 'pending'")
    pending_registrations = cursor.fetchone()["count"]
    
    # Approved courses (total approved registrations)
    cursor.execute("SELECT COUNT(*) as count FROM course_registrations WHERE status = 'approved'")
    approved_courses = cursor.fetchone()["count"]
    
    # Total courses
    cursor.execute("SELECT COUNT(*) as count FROM courses")
    total_courses = cursor.fetchone()["count"]
    
    # Students with grades
    cursor.execute("SELECT COUNT(DISTINCT student_id) as count FROM grades")
    students_with_grades = cursor.fetchone()["count"]
    
    conn.close()
    
    return DashboardStats(
        total_students=total_students,
        pending_registrations=pending_registrations,
        approved_courses=approved_courses,
        total_courses=total_courses,
        students_with_grades=students_with_grades
    )

@app.get("/students", response_model=List[UserResponse])
async def get_students(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE role = 'student' ORDER BY student_id")
    students = cursor.fetchall()
    conn.close()
    
    return [
        UserResponse(
            id=s["id"],
            student_id=s["student_id"],
            name=s["name"],
            email=s["email"] if "email" in s.keys() else None,
            role=s["role"] if "role" in s.keys() else "student",
            year=s["year"],
            profile_photo=s["profile_photo"] if "profile_photo" in s.keys() else None
        )
        for s in students
    ]

# ============================================
# ANALYTICS ENDPOINTS
# ============================================

@app.get("/dashboard/booking-stats", response_model=BookingStats)
async def get_booking_stats(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Daily bookings (last 30 days)
    cursor.execute("""
        SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count
        FROM bookings
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY strftime('%Y-%m-%d', created_at)
        ORDER BY date
    """)
    daily_data = cursor.fetchall()
    daily = [{"date": row["date"], "count": row["count"]} for row in daily_data]
    
    # Weekly bookings (last 12 weeks)
    cursor.execute("""
        SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
        FROM bookings
        WHERE created_at >= datetime('now', '-84 days')
        GROUP BY strftime('%Y-W%W', created_at)
        ORDER BY week
    """)
    weekly_data = cursor.fetchall()
    weekly = [{"week": row["week"], "count": row["count"]} for row in weekly_data]
    
    # Monthly bookings (last 12 months)
    cursor.execute("""
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
        FROM bookings
        WHERE created_at >= datetime('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month
    """)
    monthly_data = cursor.fetchall()
    monthly = [{"month": row["month"], "count": row["count"]} for row in monthly_data]
    
    # Most booked rooms
    cursor.execute("""
        SELECT room_name, COUNT(*) as count
        FROM bookings
        GROUP BY room_name
        ORDER BY count DESC
        LIMIT 10
    """)
    rooms_data = cursor.fetchall()
    most_booked_rooms = [{"room_name": row["room_name"], "count": row["count"]} for row in rooms_data]
    
    conn.close()
    
    return BookingStats(
        daily=daily,
        weekly=weekly,
        monthly=monthly,
        most_booked_rooms=most_booked_rooms
    )

@app.get("/dashboard/chat-stats", response_model=ChatStats)
async def get_chat_stats(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Total messages
    cursor.execute("SELECT COUNT(*) as count FROM chat_messages")
    total_messages = cursor.fetchone()["count"]
    
    # Messages by room
    cursor.execute("""
        SELECT room, COUNT(*) as count
        FROM chat_messages
        GROUP BY room
        ORDER BY count DESC
    """)
    rooms_data = cursor.fetchall()
    messages_by_room = [{"room": row["room"], "count": row["count"]} for row in rooms_data]
    
    # Messages by date (last 30 days)
    cursor.execute("""
        SELECT date, COUNT(*) as count
        FROM chat_messages
        WHERE date >= date('now', '-30 days')
        GROUP BY date
        ORDER BY date
    """)
    date_data = cursor.fetchall()
    messages_by_date = [{"date": row["date"], "count": row["count"]} for row in date_data]
    
    conn.close()
    
    return ChatStats(
        total_messages=total_messages,
        messages_by_room=messages_by_room,
        messages_by_date=messages_by_date
    )

@app.get("/dashboard/gpa-stats", response_model=GPAStats)
async def get_gpa_stats(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Get all grades with credits
    cursor.execute("""
        SELECT g.grade, c.credits, g.student_id
        FROM grades g
        JOIN courses c ON g.course_id = c.id
    """)
    all_grades = cursor.fetchall()
    
    # Calculate GPA for each student
    grade_points = {
        "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5,
        "C": 2.0, "D+": 1.5, "D": 1.0, "F": 0.0
    }
    
    student_gpas = {}
    for grade_data in all_grades:
        student_id = grade_data["student_id"]
        grade = grade_data["grade"].upper()
        credits = grade_data["credits"]
        
        if student_id not in student_gpas:
            student_gpas[student_id] = {"points": 0, "credits": 0}
        
        if grade in grade_points:
            student_gpas[student_id]["points"] += grade_points[grade] * credits
            student_gpas[student_id]["credits"] += credits
    
    # Calculate GPAs
    gpas = []
    for student_id, data in student_gpas.items():
        if data["credits"] > 0:
            gpa = data["points"] / data["credits"]
            gpas.append(gpa)
    
    # Calculate average GPA
    average_gpa = round(sum(gpas) / len(gpas), 2) if gpas else 0.0
    
    # GPA distribution
    distribution = {
        "4.0": 0, "3.5-3.9": 0, "3.0-3.4": 0,
        "2.5-2.9": 0, "2.0-2.4": 0, "Below 2.0": 0
    }
    
    for gpa in gpas:
        if gpa >= 4.0:
            distribution["4.0"] += 1
        elif gpa >= 3.5:
            distribution["3.5-3.9"] += 1
        elif gpa >= 3.0:
            distribution["3.0-3.4"] += 1
        elif gpa >= 2.5:
            distribution["2.5-2.9"] += 1
        elif gpa >= 2.0:
            distribution["2.0-2.4"] += 1
        else:
            distribution["Below 2.0"] += 1
    
    gpa_distribution = [{"range": k, "count": v} for k, v in distribution.items()]
    
    conn.close()
    
    return GPAStats(
        average_gpa=average_gpa,
        gpa_distribution=gpa_distribution,
        students_with_gpa=len(gpas)
    )

@app.get("/dashboard/credit-stats", response_model=CreditUsageStats)
async def get_credit_stats(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Total credits from approved registrations
    cursor.execute("""
        SELECT SUM(c.credits) as total
        FROM course_registrations cr
        JOIN courses c ON cr.course_id = c.id
        WHERE cr.status = 'approved'
    """)
    total_result = cursor.fetchone()
    total_credits = total_result["total"] if total_result["total"] else 0
    
    # Credits by semester
    cursor.execute("""
        SELECT cr.semester, cr.year, SUM(c.credits) as total
        FROM course_registrations cr
        JOIN courses c ON cr.course_id = c.id
        WHERE cr.status = 'approved'
        GROUP BY cr.semester, cr.year
        ORDER BY cr.year DESC, cr.semester DESC
    """)
    semester_data = cursor.fetchall()
    credits_by_semester = [
        {"semester": f"{row['year']}-S{row['semester']}", "credits": row["total"]}
        for row in semester_data
    ]
    
    # Average credits per student
    cursor.execute("""
        SELECT COUNT(DISTINCT cr.student_id) as student_count
        FROM course_registrations cr
        WHERE cr.status = 'approved'
    """)
    student_count_result = cursor.fetchone()
    student_count = student_count_result["student_count"] if student_count_result["student_count"] else 1
    
    average_credits = round(total_credits / student_count, 2) if student_count > 0 else 0.0
    
    conn.close()
    
    return CreditUsageStats(
        total_credits=total_credits,
        credits_by_semester=credits_by_semester,
        average_credits_per_student=average_credits
    )

@app.get("/dashboard/user-activity", response_model=UserActivityStats)
async def get_user_activity_stats(current_user = Depends(get_current_admin)):
    conn = get_db()
    cursor = conn.cursor()
    
    # New users by date (last 30 days)
    cursor.execute("""
        SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count
        FROM users
        WHERE role = 'student' AND created_at >= datetime('now', '-30 days')
        GROUP BY strftime('%Y-%m-%d', created_at)
        ORDER BY date
    """)
    date_data = cursor.fetchall()
    new_users_by_date = [{"date": row["date"], "count": row["count"]} for row in date_data]
    
    # Total active users (users who have made bookings or sent messages in last 30 days)
    cursor.execute("""
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
            SELECT user_id FROM bookings WHERE created_at >= datetime('now', '-30 days')
            UNION
            SELECT user_id FROM chat_messages WHERE timestamp >= (strftime('%s', 'now', '-30 days') * 1000)
        )
    """)
    active_result = cursor.fetchone()
    total_active_users = active_result["count"] if active_result["count"] else 0
    
    conn.close()
    
    return UserActivityStats(
        new_users_by_date=new_users_by_date,
        total_active_users=total_active_users
    )

# ============================================
# PROFILE ENDPOINTS
# ============================================

@app.put("/profile", response_model=UserResponse)
async def update_profile(
    profile: ProfileUpdate,
    current_user = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    
    updates = []
    values = []
    
    if profile.name is not None:
        updates.append("name = ?")
        values.append(profile.name)
    if profile.email is not None:
        updates.append("email = ?")
        values.append(profile.email)
    if profile.year is not None:
        if profile.year not in [1, 2, 3, 4]:
            conn.close()
            raise HTTPException(status_code=400, detail="Year must be 1, 2, 3, or 4")
        updates.append("year = ?")
        values.append(profile.year)
    
    if not updates:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    
    values.append(current_user["id"])
    cursor.execute(
        f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
        values
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],))
    updated_user = cursor.fetchone()
    conn.close()
    
    return UserResponse(
        id=updated_user["id"],
        student_id=updated_user["student_id"],
        name=updated_user["name"],
        email=updated_user["email"] if "email" in updated_user.keys() else None,
        role=updated_user["role"] if "role" in updated_user.keys() else "student",
        year=updated_user["year"],
        profile_photo=updated_user["profile_photo"] if "profile_photo" in updated_user.keys() else None
    )

@app.put("/profile/photo")
async def update_profile_photo(
    photo_url: str,
    current_user = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE users SET profile_photo = ? WHERE id = ?",
        (photo_url, current_user["id"])
    )
    conn.commit()
    conn.close()
    
    return {"message": "Profile photo updated successfully"}

# ============================================
# ATTENDANCE ENDPOINTS
# ============================================

class AttendanceSessionCreate(BaseModel):
    course_id: int
    session_date: str  # Format: YYYY-MM-DD
    time_slot: str  # Format: HH:MM-HH:MM

class EventCreate(BaseModel):
    event_name: str
    event_date: str  # Format: YYYY-MM-DD
    time_slot: str  # Format: HH:MM-HH:MM

class AttendanceSessionResponse(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_title: str
    session_date: str
    time_slot: str
    created_by: int
    created_at: str

class AttendanceRecordResponse(BaseModel):
    id: int
    session_id: int
    student_id: int
    student_student_id: str
    student_name: str
    checked_in_at: str

class EventResponse(BaseModel):
    id: int
    event_name: str
    event_date: str
    time_slot: str
    created_by: int
    created_at: str

class EventAttendanceRecordResponse(BaseModel):
    id: int
    event_id: int
    student_id: int
    student_student_id: str
    student_name: str
    attended_at: str

@app.post("/attendance/sessions", response_model=AttendanceSessionResponse)
async def create_attendance_session(
    session: AttendanceSessionCreate,
    current_user = Depends(get_current_admin)
):
    """Create a new attendance session"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get course info
    cursor.execute("SELECT * FROM courses WHERE id = ?", (session.course_id,))
    course = cursor.fetchone()
    if not course:
        conn.close()
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Create attendance session
    cursor.execute(
        """INSERT INTO attendance_sessions (course_id, course_code, course_title, session_date, time_slot, created_by)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session.course_id, course["code"], course["title"], session.session_date, session.time_slot, current_user["id"])
    )
    session_id = cursor.lastrowid
    
    # Get all students registered for this course (approved registrations)
    cursor.execute(
        """SELECT DISTINCT u.id, u.student_id, u.name
           FROM users u
           JOIN course_registrations cr ON u.id = cr.student_id
           WHERE cr.course_id = ? AND cr.status = 'approved'""",
        (session.course_id,)
    )
    students = cursor.fetchall()
    
    # Create notifications for all registered students
    for student in students:
        cursor.execute(
            """INSERT INTO notifications (user_id, type, title, message)
               VALUES (?, ?, ?, ?)""",
            (
                student["id"],
                "attendance",
                f"Attendance Check Available - {course['code']}",
                f"Attendance check is available for {course['code']} on {session.session_date} at {session.time_slot}. Click 'Check' to mark your attendance.",
            )
        )
    
    conn.commit()
    
    # Get created session
    cursor.execute("SELECT * FROM attendance_sessions WHERE id = ?", (session_id,))
    created_session = cursor.fetchone()
    
    conn.close()
    
    return AttendanceSessionResponse(
        id=created_session["id"],
        course_id=created_session["course_id"],
        course_code=created_session["course_code"],
        course_title=created_session["course_title"],
        session_date=created_session["session_date"],
        time_slot=created_session["time_slot"],
        created_by=created_session["created_by"],
        created_at=created_session["created_at"]
    )

@app.post("/attendance/check-in/{session_id}")
async def check_in_attendance(
    session_id: int,
    current_user = Depends(get_current_user)
):
    """Student checks in for attendance"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get session
    cursor.execute("SELECT * FROM attendance_sessions WHERE id = ?", (session_id,))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Attendance session not found")
    
    # Check if already checked in
    cursor.execute(
        "SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?",
        (session_id, current_user["id"])
    )
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Already checked in for this session")
    
    # Check if student is registered for this course
    cursor.execute(
        """SELECT * FROM course_registrations 
           WHERE student_id = ? AND course_id = ? AND status = 'approved'""",
        (current_user["id"], session["course_id"])
    )
    registration = cursor.fetchone()
    if not registration:
        conn.close()
        raise HTTPException(status_code=403, detail="You are not registered for this course")
    
    # Create attendance record
    cursor.execute(
        """INSERT INTO attendance_records (session_id, student_id, student_student_id, student_name)
           VALUES (?, ?, ?, ?)""",
        (session_id, current_user["id"], current_user["student_id"], current_user["name"])
    )
    
    conn.commit()
    conn.close()
    
    return {"message": "Attendance checked in successfully"}

@app.get("/attendance/sessions", response_model=List[AttendanceSessionResponse])
async def get_attendance_sessions(
    course_id: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    """Get attendance sessions (admin sees all, students see sessions for their courses)"""
    conn = get_db()
    cursor = conn.cursor()
    
    role = current_user["role"] if "role" in current_user.keys() else "student"
    
    if role == "admin":
        if course_id:
            cursor.execute(
                "SELECT * FROM attendance_sessions WHERE course_id = ? ORDER BY session_date DESC, time_slot DESC",
                (course_id,)
            )
        else:
            cursor.execute("SELECT * FROM attendance_sessions ORDER BY session_date DESC, time_slot DESC")
    else:
        # Students see only sessions for courses they're registered in
        cursor.execute(
            """SELECT DISTINCT a.* FROM attendance_sessions a
               JOIN course_registrations cr ON a.course_id = cr.course_id
               WHERE cr.student_id = ? AND cr.status = 'approved'
               ORDER BY a.session_date DESC, a.time_slot DESC""",
            (current_user["id"],)
        )
    
    sessions = cursor.fetchall()
    conn.close()
    
    return [
        AttendanceSessionResponse(
            id=s["id"],
            course_id=s["course_id"],
            course_code=s["course_code"],
            course_title=s["course_title"],
            session_date=s["session_date"],
            time_slot=s["time_slot"],
            created_by=s["created_by"],
            created_at=s["created_at"]
        )
        for s in sessions
    ]

@app.get("/attendance/sessions/{session_id}/records", response_model=List[AttendanceRecordResponse])
async def get_attendance_records(
    session_id: int,
    current_user = Depends(get_current_admin)
):
    """Get attendance records for a specific session (admin only)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify session exists
    cursor.execute("SELECT * FROM attendance_sessions WHERE id = ?", (session_id,))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Attendance session not found")
    
    # Get all attendance records for this session
    cursor.execute(
        """SELECT * FROM attendance_records 
           WHERE session_id = ? 
           ORDER BY checked_in_at ASC""",
        (session_id,)
    )
    records = cursor.fetchall()
    conn.close()
    
    return [
        AttendanceRecordResponse(
            id=r["id"],
            session_id=r["session_id"],
            student_id=r["student_id"],
            student_student_id=r["student_student_id"],
            student_name=r["student_name"],
            checked_in_at=r["checked_in_at"]
        )
        for r in records
    ]

# ============================================
# EVENT ENDPOINTS
# ============================================

@app.post("/events", response_model=EventResponse)
async def create_event(
    event: EventCreate,
    current_user = Depends(get_current_admin)
):
    """Create a new event announcement"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create event
    cursor.execute(
        """INSERT INTO events (event_name, event_date, time_slot, created_by)
           VALUES (?, ?, ?, ?)""",
        (event.event_name, event.event_date, event.time_slot, current_user["id"])
    )
    event_id = cursor.lastrowid
    
    # Get ALL students (not just course-registered ones)
    cursor.execute(
        """SELECT id, student_id, name FROM users WHERE role != 'admin' OR role IS NULL"""
    )
    students = cursor.fetchall()
    
    # Create notifications for all students
    for student in students:
        cursor.execute(
            """INSERT INTO notifications (user_id, type, title, message)
               VALUES (?, ?, ?, ?)""",
            (
                student["id"],
                "event",
                f"Event Announcement - {event.event_name}",
                f"Event '{event.event_name}' is scheduled on {event.event_date} at {event.time_slot}. Click 'Attend' to confirm your attendance.",
            )
        )
    
    conn.commit()
    
    # Get created event
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    created_event = cursor.fetchone()
    
    conn.close()
    
    return EventResponse(
        id=created_event["id"],
        event_name=created_event["event_name"],
        event_date=created_event["event_date"],
        time_slot=created_event["time_slot"],
        created_by=created_event["created_by"],
        created_at=created_event["created_at"]
    )

@app.post("/events/{event_id}/attend")
async def attend_event(
    event_id: int,
    current_user = Depends(get_current_user)
):
    """Student attends an event"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify event exists
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if already attended
    cursor.execute(
        "SELECT * FROM event_attendance_records WHERE event_id = ? AND student_id = ?",
        (event_id, current_user["id"])
    )
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="You have already attended this event")
    
    # Get student info
    try:
        student_id = current_user["student_id"]
        student_name = current_user["name"]
    except (KeyError, TypeError):
        conn.close()
        raise HTTPException(status_code=400, detail="Student information not found")
    
    # Create attendance record
    cursor.execute(
        """INSERT INTO event_attendance_records (event_id, student_id, student_student_id, student_name)
           VALUES (?, ?, ?, ?)""",
        (event_id, current_user["id"], student_id, student_name)
    )
    conn.commit()
    conn.close()
    
    return {"message": "Event attendance recorded successfully"}

@app.get("/events", response_model=List[EventResponse])
async def get_events(current_user = Depends(get_current_user)):
    """Get all events (both admin and students can see all events)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM events ORDER BY event_date DESC, time_slot DESC")
    events = cursor.fetchall()
    conn.close()
    
    return [
        EventResponse(
            id=e["id"],
            event_name=e["event_name"],
            event_date=e["event_date"],
            time_slot=e["time_slot"],
            created_by=e["created_by"],
            created_at=e["created_at"]
        )
        for e in events
    ]

@app.get("/events/{event_id}/attendance", response_model=List[EventAttendanceRecordResponse])
async def get_event_attendance(
    event_id: int,
    current_user = Depends(get_current_admin)
):
    """Get attendance records for a specific event (admin only)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify event exists
    cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Get all attendance records for this event
    cursor.execute(
        """SELECT * FROM event_attendance_records 
           WHERE event_id = ? 
           ORDER BY attended_at ASC""",
        (event_id,)
    )
    records = cursor.fetchall()
    conn.close()
    
    return [
        EventAttendanceRecordResponse(
            id=r["id"],
            event_id=r["event_id"],
            student_id=r["student_id"],
            student_student_id=r["student_student_id"],
            student_name=r["student_name"],
            attended_at=r["attended_at"]
        )
        for r in records
    ]

# ============================================
# ADMIN USER MANAGEMENT ENDPOINTS
# ============================================

class AdminUserCreate(BaseModel):
    student_id: str
    password: str
    name: Optional[str] = None
    year: Optional[int] = None

@app.get("/admin/users", response_model=List[UserResponse])
async def get_admin_users(current_user = Depends(get_current_admin)):
    """Get all admin users (admin only)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE role = 'admin' ORDER BY created_at DESC")
    admins = cursor.fetchall()
    conn.close()
    
    return [
        UserResponse(
            id=admin["id"],
            student_id=admin["student_id"],
            name=admin["name"],
            year=admin["year"]
        )
        for admin in admins
    ]

@app.post("/admin/users", response_model=UserResponse)
async def create_admin_user(admin_data: AdminUserCreate, current_user = Depends(get_current_admin)):
    """Create a new admin user or convert existing user to admin (admin only)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Validate student ID format
    if not admin_data.student_id or len(admin_data.student_id) != 8:
        conn.close()
        raise HTTPException(status_code=400, detail="Student ID must be exactly 8 digits")
    
    # Validate password
    if not admin_data.password or len(admin_data.password) < 6:
        conn.close()
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if user already exists
    cursor.execute("SELECT * FROM users WHERE student_id = ?", (admin_data.student_id,))
    existing_user = cursor.fetchone()
    
    if existing_user:
        # Convert existing user to admin and update password
        hashed_password = get_password_hash(admin_data.password)
        cursor.execute(
            "UPDATE users SET role = 'admin', password_hash = ? WHERE student_id = ?",
            (hashed_password, admin_data.student_id)
        )
        conn.commit()
        conn.close()
        
        return UserResponse(
            id=existing_user["id"],
            student_id=existing_user["student_id"],
            name=existing_user["name"],
            year=existing_user["year"]
        )
    else:
        # Create new admin user
        # Use provided name or default to student_id, use provided year or default to 1
        name = admin_data.name if admin_data.name else admin_data.student_id
        year = admin_data.year if admin_data.year else 1
        
        # Validate year if provided
        if year not in [1, 2, 3, 4]:
            conn.close()
            raise HTTPException(status_code=400, detail="Year must be 1, 2, 3, or 4")
        
        hashed_password = get_password_hash(admin_data.password)
        
        try:
            cursor.execute(
                "INSERT INTO users (student_id, name, password_hash, year, role) VALUES (?, ?, ?, ?, 'admin')",
                (admin_data.student_id, name, hashed_password, year)
            )
            conn.commit()
            user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            conn.close()
            raise HTTPException(status_code=400, detail="Student ID already exists")
        
        conn.close()
        
        return UserResponse(
            id=user_id,
            student_id=admin_data.student_id,
            name=name,
            year=year
        )

# ============================================
# HEALTH CHECK
# ============================================

@app.get("/")
async def root():
    return {"message": " Booking System API", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    import logging
    
    # Configure logging to see errors
    logging.basicConfig(level=logging.INFO)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")