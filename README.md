# SE Student Portal Web Application

A comprehensive web application for Software Engineering students to manage course registrations, attendance, events, chatrooms, and more.

## 🚀 Features

- **User Authentication**: Student and Admin login/signup with JWT tokens
- **Course Management**: View and register for courses
- **Attendance System**: Admin can create attendance sessions, students can check in
- **Event Management**: Admin can create events, students can mark attendance
- **Chatrooms**: 
  - Year group chatrooms for all students
  - Course-specific chatrooms (auto-created when admin adds a course)
  - Admin can message and delete chatrooms
- **Calendar**: Admin calendar view for managing attendance sessions and events
- **GPA Calculator**: Track and calculate student GPA
- **Profile Management**: View and update student profiles
- **Notifications**: Real-time notifications for course approvals, attendance sessions, and events

## 📁 Project Structure

```
SE_Student_Portal_Web_Final_Project-FULLFIXED/
├── Backend/                 # FastAPI backend server
│   ├── main.py             # Main application file
│   ├── requirements.txt   # Python dependencies
│   ├── create_admin.py     # Admin user creation script
│   └── portal.db          # SQLite database (auto-generated)
│
├── se-booking-frontend/    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   ├── components/    # Reusable components
│   │   ├── styles/        # CSS stylesheets
│   │   └── utils/         # Utility functions
│   ├── package.json       # Node dependencies
│   └── vite.config.js     # Vite configuration
│
└── README.md              # This file
```

## 🛠️ Prerequisites

- **Python 3.12+** (for backend)
- **Node.js 18+** and **npm** (for frontend)
- **Git** (for version control)

## 📦 Installation

### Backend Setup

1. Navigate to the Backend directory:
   ```bash
   cd Backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create an admin user:
   ```bash
   python create_admin.py
   ```
   Follow the prompts to create your admin account.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd se-booking-frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

## 🚀 Running the Application

### Start the Backend Server

From the `Backend` directory:

```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base URL**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Start the Frontend Development Server

From the `se-booking-frontend` directory:

```bash
npm run dev
```

The frontend will be available at:
- **Frontend URL**: http://localhost:5173 (or the port shown in terminal)

## 🔐 Default Admin Access

After running `create_admin.py`, you can log in with:
- **Username/Student ID**: The one you created
- **Password**: The password you set

## 📚 API Documentation

Once the backend is running, you can access:
- **Swagger UI**: http://localhost:8000/docs - Interactive API documentation
- **ReDoc**: http://localhost:8000/redoc - Alternative API documentation

## 🗄️ Database

The application uses SQLite database (`portal.db`) which is automatically created on first run. The database includes:

- Users (students and admins)
- Courses
- Course registrations
- Attendance sessions and records
- Events and event attendance
- Chatrooms and messages
- Notifications

## 🔧 Configuration

### Backend Configuration

The backend uses environment variables (optional). You can create a `.env` file in the `Backend` directory:

```env
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend Configuration

API endpoint is configured in `src/config/constants.js`. Default is `http://localhost:8000`.

## 📝 Available Scripts

### Backend
- `python main.py` - Start the FastAPI server
- `python create_admin.py` - Create or manage admin users
- `uvicorn main:app --reload` - Start with auto-reload

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🎨 Features Overview

### For Students
- Register and login
- View available courses
- Register for courses
- Check attendance for registered courses
- Attend events and mark attendance
- Join year group and course chatrooms
- Send and receive messages
- View notifications
- Calculate and track GPA
- View and update profile

### For Administrators
- All student features plus:
- Approve/reject course registrations
- Create attendance sessions
- Create event announcements
- View attendance records
- View event attendance lists
- Manage all chatrooms (year groups and courses)
- Delete course chatrooms
- Calendar view for managing sessions and events

## 🐛 Troubleshooting

### Backend Issues
- **Port already in use**: Change the port in `main.py` or kill the process using port 8000
- **Database errors**: Delete `portal.db` and restart (this will reset all data)
- **Import errors**: Make sure all dependencies are installed: `pip install -r requirements.txt`

### Frontend Issues
- **Port already in use**: Vite will automatically use the next available port
- **API connection errors**: Ensure backend is running on port 8000
- **Build errors**: Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

## 📄 License

This project is for educational purposes.

## 👥 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For issues and questions, please open an issue on the GitHub repository.

---

**Note**: Make sure to never commit sensitive information like `.env` files, database files, or API keys to version control. The `.gitignore` files are configured to exclude these.

