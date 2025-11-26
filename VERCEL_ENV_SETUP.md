# Vercel Environment Variable Setup - URGENT

## ⚠️ Your app is currently trying to connect to localhost:8000 because the environment variable is not set!

## Quick Fix Steps:

### 1. Go to Vercel Dashboard
- Visit https://vercel.com/dashboard
- Select your project

### 2. Navigate to Settings
- Click on **Settings** in the top menu
- Click on **Environment Variables** in the left sidebar

### 3. Add the Environment Variable
Click **Add New** and enter:
- **Key**: `VITE_API_URL`
- **Value**: Your backend API URL (e.g., `https://your-backend.railway.app` or `https://your-backend.onrender.com`)
- **Environment**: Select **Production**, **Preview**, and **Development** (or at least **Production**)

### 4. Redeploy
- After adding the environment variable, you **MUST redeploy** for it to take effect
- Go to **Deployments** tab
- Click the **⋯** (three dots) on your latest deployment
- Click **Redeploy**

OR

- Make a small change to your code and push to trigger a new deployment

## How to Find Your Backend URL

### If using Railway:
1. Go to https://railway.app
2. Select your project
3. Click on your service
4. Copy the URL from the **Domains** section (e.g., `https://your-app.railway.app`)

### If using Render:
1. Go to https://render.com
2. Select your service
3. Copy the URL from the dashboard (e.g., `https://your-app.onrender.com`)

### If using Fly.io:
1. Run `fly status` in your backend directory
2. Or check the Fly.io dashboard for your app URL

## Verify It's Working

After redeploying:
1. Open your Vercel app
2. Open browser console (F12)
3. Check for any errors about `VITE_API_URL`
4. Try signing up or logging in
5. Check the Network tab to see if API calls are going to the correct backend URL

## Important Notes

- ⚠️ **Vite environment variables MUST start with `VITE_`** to be accessible in the browser
- ⚠️ **Environment variables are embedded at BUILD TIME**, not runtime
- ⚠️ **You MUST redeploy after adding/changing environment variables**
- ✅ The variable name is case-sensitive: `VITE_API_URL` (all caps)

## Troubleshooting

### Still seeing localhost:8000?
1. Make sure you added `VITE_API_URL` (with `VITE_` prefix)
2. Make sure you redeployed after adding the variable
3. Check Vercel build logs to see if the variable was available during build
4. Clear your browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Getting CORS errors?
- Make sure your backend CORS settings include your Vercel domain
- See `Backend/CORS_UPDATE.md` for instructions

### Variable not showing in build?
- Check that you selected the correct environments (Production, Preview, etc.)
- Make sure there are no typos in the variable name
- Check Vercel build logs for any warnings

