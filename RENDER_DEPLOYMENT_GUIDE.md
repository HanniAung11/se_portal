# Complete Render.com Backend Deployment Guide

This is a step-by-step guide to deploy your FastAPI backend to Render.com.

## Prerequisites

1. Your code pushed to GitHub
2. A Render.com account (sign up at https://render.com)

---

## Step-by-Step Deployment

### 1️⃣ Go to Render Dashboard

1. Visit https://render.com
2. Sign in or create an account
3. Click **"New +"** button in the top right
4. Select **"Web Service"**

---

### 2️⃣ Connect Your Repository

1. **Connect account** (if not already connected):
   - Click **"Connect account"** next to GitHub
   - Authorize Render to access your repositories

2. **Select repository**:
   - Find and select: `SE_Student_Portal_Web_Final_Project-FULLFIXED`
   - Click **"Connect"**

---

### 3️⃣ Configure Your Service

Fill in the following fields:

#### **Name**
```
se-portal-backend
```
(Or any name you prefer)

#### **Region**
```
Singapore (or closest to your users)
```

#### **Branch**
```
main
```
(Or your default branch name)

#### **Root Directory**
```
Backend
```
⚠️ **IMPORTANT**: Set this to `Backend` because your FastAPI app is in the `Backend` folder

#### **Runtime**
```
Python 3
```

#### **Build Command**
```
pip install -r requirements.txt
```

#### **Start Command**
```
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Explanation:**
- `main:app` = your file is `main.py` and FastAPI app is named `app`
- `--host 0.0.0.0` = makes it accessible externally
- `--port $PORT` = uses Render's provided port (required)

---

### 4️⃣ Instance Type

- **Free**: For testing (spins down after inactivity)
- **Starter ($7/month)**: For production (always on)

Choose based on your needs. For testing, **Free** is fine.

---

### 5️⃣ Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add:

#### **SECRET_KEY** (Required)
```
Key: SECRET_KEY
Value: [Generate a strong random string - see below]
```

**Generate a secure SECRET_KEY:**
- Option 1: Use Python
  ```python
  import secrets
  print(secrets.token_urlsafe(32))
  ```
- Option 2: Use online generator: https://randomkeygen.com/
- Option 3: Use this command in terminal:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

**Example value:**
```
xK9mP2qL8vN5wR7tY3uI6oA1sD4fG0hJ2kL9mN8pQ5rS3tU6vW9xY2zA1bC4dE7f
```

#### **PYTHON_VERSION** (Optional but recommended)
```
Key: PYTHON_VERSION
Value: 3.11
```
(Or 3.10, 3.12 - check what version you're using locally)

#### **ALGORITHM** (Optional - already in code)
```
Key: ALGORITHM
Value: HS256
```
(Only if you want to override the default)

---

### 6️⃣ Create Service

1. Review all settings
2. Click **"Create Web Service"**
3. Render will start building and deploying your app

---

## Post-Deployment Steps

### 1. Get Your Backend URL

1. Wait for deployment to complete (usually 2-5 minutes)
2. Once deployed, you'll see a URL like:
   ```
   https://se-portal-backend.onrender.com
   ```
3. **Copy this URL** - you'll need it for your frontend!

### 2. Test Your Backend

1. Visit your backend URL in browser:
   ```
   https://se-portal-backend.onrender.com/docs
   ```
   You should see the FastAPI Swagger documentation.

2. Test the root endpoint:
   ```
   https://se-portal-backend.onrender.com/
   ```

### 3. Create Admin User

Your backend uses SQLite, so you'll need to create an admin user. You have two options:

#### Option A: Use Render Shell (Recommended)

1. In Render dashboard, go to your service
2. Click **"Shell"** tab
3. Run:
   ```bash
   python create_admin.py
   ```
4. Follow prompts to create admin account

#### Option B: Use API Endpoint

If you have a signup endpoint, use that first, then manually update the role in the database.

### 4. Update Frontend Environment Variable

1. Go to your **Vercel** project
2. Settings → Environment Variables
3. Update `VITE_API_URL` to your Render backend URL:
   ```
   https://se-portal-backend.onrender.com
   ```
4. **Redeploy** your Vercel frontend

### 5. Update Backend CORS

Update `Backend/main.py` CORS settings to include your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://your-frontend.vercel.app",  # Add your Vercel URL
        "https://*.vercel.app",  # Allow all Vercel preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then push the changes and Render will auto-redeploy.

---

## Important Notes

### ⚠️ Free Tier Limitations

- **Spins down after 15 minutes of inactivity**
- First request after spin-down takes ~30-50 seconds (cold start)
- Consider upgrading to Starter ($7/month) for production

### 📁 Database (SQLite)

- SQLite file (`portal.db`) is stored in Render's filesystem
- **Data persists** between deployments
- For production with high traffic, consider PostgreSQL (Render offers managed PostgreSQL)

### 🔄 Auto-Deploy

- Render automatically deploys when you push to your connected branch
- You can disable this in Settings → Auto-Deploy

### 🔍 View Logs

- Click **"Logs"** tab in Render dashboard to see real-time logs
- Useful for debugging

### 🔐 Security

- Never commit `portal.db` or sensitive data to Git
- Use environment variables for secrets (already configured)
- Your `.gitignore` should exclude `portal.db`

---

## Troubleshooting

### Build Fails

1. Check **Logs** tab for error messages
2. Verify `requirements.txt` has all dependencies
3. Check Python version compatibility

### Service Won't Start

1. Check **Logs** tab
2. Verify Start Command is correct:
   ```
   python -m uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
3. Make sure `main.py` exists in the `Backend` directory

### CORS Errors

1. Update CORS in `Backend/main.py` to include your frontend URL
2. Push changes and wait for redeploy

### Database Issues

1. SQLite file is created automatically on first run
2. If you need to reset, delete the service and recreate (or use Render Shell to delete `portal.db`)

### Slow First Request (Free Tier)

- This is normal - service spins down after inactivity
- Consider upgrading to Starter plan for always-on service

---

## Quick Reference Checklist

- [ ] Repository connected to Render
- [ ] Root Directory set to `Backend`
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] SECRET_KEY environment variable added
- [ ] Service deployed successfully
- [ ] Backend URL copied
- [ ] Frontend `VITE_API_URL` updated in Vercel
- [ ] CORS updated in backend
- [ ] Admin user created
- [ ] Tested API endpoints

---

## Example Complete Configuration Summary

```
Service Name: se-portal-backend
Service Type: Web Service
Region: Singapore
Branch: main
Root Directory: Backend
Runtime: Python 3
Build Command: pip install -r requirements.txt
Start Command: python -m uvicorn main:app --host 0.0.0.0 --port $PORT
Instance Type: Free (or Starter)

Environment Variables:
- SECRET_KEY: [your-generated-secret-key]
- PYTHON_VERSION: 3.11 (optional)
```

---

## Next Steps

After successful deployment:

1. ✅ Test your backend API
2. ✅ Update frontend `VITE_API_URL` in Vercel
3. ✅ Update backend CORS settings
4. ✅ Create admin user
5. ✅ Test full application flow

Your backend should now be live at: `https://se-portal-backend.onrender.com` 🚀

