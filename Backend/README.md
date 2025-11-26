# Backend Setup Guide

## Installation

1. Make sure you have Python 3.12 installed
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Server

```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Creating an Admin User

### Method 1: Using the Admin Creation Script (Recommended)

Run the helper script:
```bash
python create_admin.py
```

This will let you:
- Create a new admin user
- Convert an existing user to admin

### Method 2: List All Users

To see all users and their roles:
```bash
python create_admin.py list
```

### Method 3: Using SQLite Directly

```bash
sqlite3 portal.db
UPDATE users SET role = 'admin' WHERE student_id = 'YOUR_STUDENT_ID';
```

### Method 4: Convert After Signup

1. Sign up as a regular user through the web interface
2. Then run:
   ```bash
   python create_admin.py
   ```
   Choose option 2 and enter the student ID

## Database

The database file `portal.db` will be created automatically on first run.

