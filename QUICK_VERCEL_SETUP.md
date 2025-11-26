# Quick Vercel Setup Guide

## 🚀 Quick Steps

### 1. Deploy Backend First
Deploy your FastAPI backend to Railway, Render, or Fly.io and get the URL.

### 2. Deploy Frontend to Vercel

**Option A: Via Vercel Dashboard (Easiest)**
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Set **Root Directory** to: `se-booking-frontend`
4. Add environment variable:
   - Name: `VITE_API_URL`
   - Value: `https://your-backend-url.railway.app` (your actual backend URL)
5. Click Deploy

**Option B: Via CLI**
```bash
cd se-booking-frontend
npm i -g vercel
vercel login
vercel
# When prompted, add VITE_API_URL environment variable
```

### 3. Update Backend CORS
In `Backend/main.py`, update CORS to include your Vercel URL:
```python
allow_origins=[
    "http://localhost:5173",
    "https://your-app.vercel.app",  # Add this
    "https://*.vercel.app",  # Add this for preview deployments
]
```

## 📁 Files Created

- `vercel.json` - Root Vercel configuration
- `se-booking-frontend/vercel.json` - Frontend-specific configuration
- `VERCEL_DEPLOYMENT.md` - Detailed deployment guide
- `Backend/CORS_UPDATE.md` - CORS configuration guide

## ✅ What's Configured

- ✅ Vite build configuration
- ✅ SPA routing (all routes → index.html)
- ✅ Environment variable support (`VITE_API_URL`)
- ✅ API URL configuration updated in code

## 🔧 Environment Variables Needed

| Variable | Value | Where to Set |
|----------|-------|--------------|
| `VITE_API_URL` | Your backend API URL | Vercel Dashboard → Settings → Environment Variables |

## 📝 Notes

- The frontend will automatically use `/api` proxy in development
- In production, it uses the `VITE_API_URL` environment variable
- Make sure your backend CORS allows your Vercel domain

