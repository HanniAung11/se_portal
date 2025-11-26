# Render.com Deployment - Quick Reference Card

## Fill These Exact Values:

| Field | Value |
|-------|-------|
| **Service Type** | `Web Service` |
| **Name** | `se-portal-backend` |
| **Region** | `Singapore` (or closest) |
| **Branch** | `main` |
| **Root Directory** | `Backend` ⚠️ **IMPORTANT** |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python -m uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | `Free` (or `Starter` for production) |

## Environment Variables to Add:

1. **SECRET_KEY**
   - Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
   - Or use: https://randomkeygen.com/

2. **PYTHON_VERSION** (optional)
   - Value: `3.11` (or your Python version)

## After Deployment:

1. Copy your backend URL (e.g., `https://se-portal-backend.onrender.com`)
2. Update Vercel `VITE_API_URL` to this URL
3. Update CORS in `Backend/main.py` to include your Vercel domain
4. Create admin user via Render Shell: `python create_admin.py`

## Test Your Backend:

Visit: `https://se-portal-backend.onrender.com/docs`

---

📖 **Full guide**: See `RENDER_DEPLOYMENT_GUIDE.md` for detailed instructions

