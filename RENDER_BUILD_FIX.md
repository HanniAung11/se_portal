# Render Build Error Fix

## Problem
You're getting this error:
```
error: failed to create directory `/usr/local/cargo/registry/cache/...`
Caused by: Read-only file system (os error 30)
```

This happens because:
- Python 3.13.4 is being used (very new)
- `pydantic-core` requires Rust compilation
- Build environment has read-only filesystem issues

## Solution

### ✅ Fixed Files

1. **Updated `Backend/requirements.txt`** with compatible versions
2. **Created `Backend/runtime.txt`** to specify Python 3.11.10

### Steps to Fix:

1. **Pull the updated files** from your repository
   ```bash
   git pull origin main
   ```

2. **Verify `Backend/runtime.txt` exists** with:
   ```
   python-3.11.10
   ```

3. **Verify `Backend/requirements.txt`** has updated versions:
   ```
   fastapi==0.115.0
   uvicorn[standard]==0.32.0
   python-jose[cryptography]==3.3.0
   passlib[bcrypt]==1.7.4
   python-multipart==0.0.12
   pydantic==2.9.2
   bcrypt==4.2.0
   ```

4. **Commit and push** the changes:
   ```bash
   git add Backend/requirements.txt Backend/runtime.txt
   git commit -m "Fix: Update dependencies and Python version for Render"
   git push origin main
   ```

5. **Render will auto-redeploy** - the build should now succeed!

### Alternative: Set Python Version in Render Dashboard

If you prefer not to use `runtime.txt`:

1. Go to Render Dashboard → Your Service → Settings
2. Add Environment Variable:
   - **Key**: `PYTHON_VERSION`
   - **Value**: `3.11.10`
3. Save and redeploy

## Why This Works

- **Python 3.11.10** has better package wheel support
- **Updated pydantic to 2.9.2** which has pre-built wheels
- **Updated other packages** to compatible versions
- Avoids Rust compilation issues

## Verify Build Success

After redeploying, check the logs:
- ✅ Should see: "Using Python version 3.11.10"
- ✅ Should see: "Successfully installed..." for all packages
- ✅ Should see: "Your service is live at..."

## If Still Having Issues

1. Check Render logs for specific error
2. Try Python 3.12.0 instead:
   ```
   python-3.12.0
   ```
3. Make sure `runtime.txt` is in the `Backend` folder (not root)

