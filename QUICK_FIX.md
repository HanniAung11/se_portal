# Quick Fix for "Failed to fetch" Error

## The Problem
You're seeing "Failed to fetch" even though the backend is running. This is usually a CORS or connection issue.

## Solution 1: Use Vite Proxy (Recommended)

I've configured a proxy in `vite.config.js`. **You need to restart your frontend dev server:**

1. **Stop the frontend** (Ctrl+C in the terminal running `npm run dev`)
2. **Restart it:**
   ```bash
   cd se-booking-frontend
   npm run dev
   ```

The proxy will route all `/api/*` requests to `http://localhost:8000/*` automatically.

## Solution 2: If Proxy Doesn't Work

If you still see the error, try this:

1. **Check what port your frontend is running on:**
   - Look at the terminal where you ran `npm run dev`
   - It should show something like: `Local: http://localhost:5173/`

2. **Update Backend CORS** to include your exact frontend URL:
   - Open `Backend/main.py`
   - Find the `allow_origins` list (around line 26)
   - Add your frontend URL if it's different from `http://localhost:5173`

3. **Restart the backend:**
   ```bash
   cd Backend
   python main.py
   ```

## Solution 3: Direct Connection (Temporary Fix)

If you need a quick workaround, you can temporarily use the direct URL:

1. Open `se-booking-frontend/src/App.jsx`
2. Find line 5: `const API_BASE_URL = ...`
3. Change it to:
   ```javascript
   const API_BASE_URL = "http://localhost:8000";
   ```
4. Restart the frontend

## Verify It's Working

1. Open browser Developer Tools (F12)
2. Go to Network tab
3. Try to login
4. Look for the `/login` request
5. Check:
   - Status should be 200 (not failed)
   - Response should show the token

## Still Not Working?

Check these:

1. **Backend is running:**
   ```bash
   curl http://localhost:8000/
   ```
   Should return: `{"message":" Booking System API","status":"running"}`

2. **No firewall blocking:**
   - Windows Firewall might be blocking Python
   - Try temporarily disabling it to test

3. **Browser console errors:**
   - Press F12 → Console tab
   - Look for any red error messages
   - Share them if you see any

4. **Try a different browser:**
   - Sometimes browser extensions block requests
   - Try Chrome, Firefox, or Edge

