# CORS Configuration Update for Production

When deploying to production, update the CORS configuration in `Backend/main.py` to include your Vercel domain.

## Current Configuration (Development)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"  # Allow all for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Production Configuration

Replace the `allow_origins` list with your actual domains:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Keep for local development
        "http://localhost:3000",
        "https://your-app.vercel.app",  # Your Vercel production URL
        "https://*.vercel.app",  # Allow all Vercel preview deployments
        # Add your backend domain if different
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Important Notes

- Remove `"*"` from `allow_origins` in production for security
- Add your specific Vercel domain after deployment
- `*.vercel.app` allows all preview deployments automatically
- Keep localhost URLs for local development

