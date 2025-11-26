"""Script to create an admin user or convert existing user to admin"""
import sqlite3
import sys
import bcrypt

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_admin():
    """Create a new admin user or convert existing user to admin"""
    conn = sqlite3.connect("portal.db")
    cursor = conn.cursor()
    
    print("=" * 50)
    print("Admin Account Setup")
    print("=" * 50)
    
    # Check if user wants to create new or convert existing
    choice = input("\n1. Create new admin user\n2. Convert existing user to admin\nChoose (1 or 2): ").strip()
    
    if choice == "1":
        # Create new admin user
        student_id = input("Enter Student ID (8 digits): ").strip()
        name = input("Enter Full Name: ").strip()
        password = input("Enter Password: ").strip()
        year = input("Enter Year (1-4): ").strip()
        
        if not student_id or len(student_id) != 8:
            print("❌ Student ID must be exactly 8 digits")
            conn.close()
            return
        
        if not password or len(password) < 6:
            print("❌ Password must be at least 6 characters")
            conn.close()
            return
        
        try:
            year = int(year)
            if year not in [1, 2, 3, 4]:
                print("❌ Year must be 1, 2, 3, or 4")
                conn.close()
                return
        except ValueError:
            print("❌ Year must be a number")
            conn.close()
            return
        
        # Check if user already exists
        cursor.execute("SELECT * FROM users WHERE student_id = ?", (student_id,))
        existing = cursor.fetchone()
        if existing:
            print(f"❌ User with Student ID {student_id} already exists")
            convert = input("Convert to admin? (y/n): ").strip().lower()
            if convert == 'y':
                cursor.execute("UPDATE users SET role = 'admin' WHERE student_id = ?", (student_id,))
                conn.commit()
                print(f"✅ User {student_id} converted to admin!")
            conn.close()
            return
        
        # Create new admin user
        hashed_password = get_password_hash(password)
        cursor.execute(
            "INSERT INTO users (student_id, name, password_hash, year, role) VALUES (?, ?, ?, ?, 'admin')",
            (student_id, name, hashed_password, year)
        )
        conn.commit()
        print(f"✅ Admin user created successfully!")
        print(f"   Student ID: {student_id}")
        print(f"   Name: {name}")
        print(f"   Role: admin")
        
    elif choice == "2":
        # Convert existing user to admin
        student_id = input("Enter Student ID of existing user: ").strip()
        
        cursor.execute("SELECT * FROM users WHERE student_id = ?", (student_id,))
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ User with Student ID {student_id} not found")
            conn.close()
            return
        
        cursor.execute("UPDATE users SET role = 'admin' WHERE student_id = ?", (student_id,))
        conn.commit()
        print(f"✅ User {student_id} converted to admin!")
        print(f"   Name: {user[2]}")  # Assuming name is at index 2
        
    else:
        print("❌ Invalid choice")
    
    conn.close()

def list_all_users():
    """List all users in the database"""
    conn = sqlite3.connect("portal.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT student_id, name, role, year FROM users ORDER BY student_id")
    users = cursor.fetchall()
    
    print("\n" + "=" * 50)
    print("All Users")
    print("=" * 50)
    print(f"{'Student ID':<12} {'Name':<20} {'Role':<10} {'Year':<5}")
    print("-" * 50)
    
    for user in users:
        print(f"{user[0]:<12} {user[1]:<20} {user[2]:<10} {user[3]:<5}")
    
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "list":
        list_all_users()
    else:
        create_admin()
        print("\n" + "=" * 50)
        list_all_users()

