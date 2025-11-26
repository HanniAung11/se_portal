# Database Deployment Note

## Important: Database File Included

The `Backend/portal.db` file is now included in the Git repository for deployment purposes. This means:

✅ **Your existing database (with admin accounts) will be deployed to Render**
✅ **No need to recreate admin accounts after deployment**
✅ **All your local data will be available on the deployed backend**

## Security Warning

⚠️ **Important Security Consideration:**
- Database files in Git repositories can expose sensitive data
- Anyone with access to your repository can see user passwords (hashed) and data
- Consider this a **development/testing** approach

For production, consider:
- Using environment variables for sensitive data
- Using a managed database service (PostgreSQL, MySQL)
- Implementing proper database migrations
- Using secrets management

## What Changed

1. Updated `.gitignore` to allow `Backend/portal.db`
2. Added `Backend/portal.db` to the repository
3. Database will now be included in deployments

## After Deployment

When you deploy to Render:
1. The database file will be included in the deployment
2. Your admin accounts will be available immediately
3. You can log in with your existing credentials

## Updating the Database

If you make changes to the local database and want to update the deployed version:
1. Commit the updated `Backend/portal.db` file
2. Push to GitHub
3. Render will auto-redeploy with the new database

## Reverting This Change

If you want to exclude the database again:
1. Remove `!Backend/portal.db` from `.gitignore`
2. Run: `git rm --cached Backend/portal.db`
3. Commit the changes

