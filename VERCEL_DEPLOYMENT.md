# Vercel Deployment Guide

This guide will help you deploy your SE Student Portal frontend to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Your backend API deployed (Railway, Render, Fly.io, or any hosting service)
3. Git repository pushed to GitHub

## Step 1: Deploy Backend API

Your FastAPI backend needs to be deployed separately. Recommended platforms:

### Option A: Railway (Recommended)
1. Go to https://railway.app
2. Create a new project
3. Connect your GitHub repository
4. Add a new service → Deploy from GitHub repo
5. Select your repository and set:
   - Root Directory: `Backend`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables if needed
7. Railway will provide a URL like: `https://your-app.railway.app`

### Option B: Render
1. Go to https://render.com
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Root Directory: `Backend`
5. Render will provide a URL like: `https://your-app.onrender.com`

### Option C: Fly.io
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. In the `Backend` directory, run: `fly launch`
3. Follow the prompts
4. Deploy: `fly deploy`

## Step 2: Deploy Frontend to Vercel

### Method 1: Using Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click "Add New Project"

2. **Import Your Repository**
   - Connect your GitHub account if not already connected
   - Select your repository: `SE_Student_Portal_Web_Final_Project-FULLFIXED`

3. **Configure Project Settings**
   - **Framework Preset**: Vite
   - **Root Directory**: `se-booking-frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Add Environment Variables**
   - Click "Environment Variables"
   - Add the following:
     ```
     VITE_API_URL=https://your-backend-api.railway.app
     ```
     (Replace with your actual backend URL)

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be live at: `https://your-app.vercel.app`

### Method 2: Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Navigate to Frontend Directory**
   ```bash
   cd se-booking-frontend
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked for environment variables, add:
     ```
     VITE_API_URL=https://your-backend-api.railway.app
     ```

5. **Set Production Environment Variable**
   ```bash
   vercel env add VITE_API_URL production
   ```
   - Enter your backend API URL when prompted

## Step 3: Update CORS in Backend

Make sure your backend allows requests from your Vercel domain:

In `Backend/main.py`, update the CORS configuration:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://your-app.vercel.app",  # Add your Vercel URL
        "https://*.vercel.app",  # Allow all Vercel preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Step 4: Verify Deployment

1. Visit your Vercel deployment URL
2. Check browser console for any errors
3. Test login functionality
4. Verify API calls are working

## Troubleshooting

### Issue: API calls failing
- **Solution**: Check that `VITE_API_URL` environment variable is set correctly in Vercel
- Verify your backend CORS settings include your Vercel domain
- Check backend logs for errors

### Issue: Build fails
- **Solution**: Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### Issue: 404 errors on page refresh
- **Solution**: The `vercel.json` rewrite rules should handle this. If not, check the configuration.

### Issue: Environment variables not working
- **Solution**: 
  - Vite requires `VITE_` prefix for environment variables
  - Redeploy after adding environment variables
  - Clear browser cache

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Your backend API URL | `https://your-app.railway.app` |

## Additional Notes

- Vercel automatically provides HTTPS
- Preview deployments are created for every push to non-main branches
- Production deployments are created for pushes to main branch
- You can set up custom domains in Vercel dashboard

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify backend API is accessible
4. Check CORS configuration

