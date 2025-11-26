# Quick Start Guide

## To Fix the 404 Error on `/api/login`:

### Step 1: Start the Backend Server

Open a **new terminal window** and run:

```bash
cd Backend
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Step 2: Keep Both Servers Running

You need **TWO terminals** running simultaneously:

**Terminal 1 - Backend:**
```bash
cd Backend
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd se-booking-frontend
npm run dev
```

### Step 3: Test the Connection

Once both are running:
1. Open your browser to `http://localhost:5173`
2. Try logging in again
3. The `/api/login` request should now work!

### Verify Backend is Running

You can test if the backend is accessible by visiting:
- http://localhost:8000/ (should show API status)
- http://localhost:8000/docs (API documentation)

---

## About the EmailJS Warnings

The "Tracking Prevention blocked access to storage" warnings are **harmless browser privacy warnings**. They don't affect functionality. If you want to remove them, you can install EmailJS as a package instead of loading from CDN, but it's not necessary.

