# Troubleshooting Guide

## "Network error. Please check if the server is running."

If you see this error when trying to login or signup, follow these steps:

### 1. Check if Backend is Running

Open a terminal and run:
```bash
cd Backend
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Test the Backend API

In another terminal, run:
```bash
cd Backend
python test_api.py
```

This will test if the API endpoints are working.

### 3. Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Try to login again
4. Look for any error messages - they will now show more details

### 4. Verify API URL

Make sure the frontend is pointing to the correct backend URL:
- Open `se-booking-frontend/src/App.jsx`
- Check line 5: `const API_BASE_URL = "http://localhost:8000";`
- This should match where your backend is running

### 5. Check CORS

The backend should have CORS enabled. Check `Backend/main.py` around line 25-31:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6. Common Issues

**Issue: Port 8000 is already in use**
- Solution: Change the port in `Backend/main.py` (line 1530) and update `API_BASE_URL` in frontend

**Issue: Firewall blocking connection**
- Solution: Allow Python through Windows Firewall

**Issue: Backend crashes on startup**
- Solution: Check the terminal for error messages. Common causes:
  - Missing dependencies: Run `pip install -r requirements.txt`
  - Database locked: Close any other programs using `portal.db`
  - Port already in use: Change the port

### 7. Test Manually

You can test the API manually using curl or Postman:

**Test root endpoint:**
```bash
curl http://localhost:8000/
```

**Test signup:**
```bash
curl -X POST http://localhost:8000/signup \
  -H "Content-Type: application/json" \
  -d '{"student_id":"12345678","name":"Test User","password":"test123","year":1}'
```

**Test login:**
```bash
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"student_id":"12345678","password":"test123"}'
```

### 8. Still Having Issues?

1. Check the browser's Network tab (F12 → Network) to see the actual HTTP request/response
2. Check the backend terminal for error messages
3. Make sure both frontend and backend are running
4. Try accessing http://localhost:8000/docs in your browser to see the API documentation

