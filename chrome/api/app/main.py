from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import test_recommend, summarize

app = FastAPI()

# Add CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add routers
app.include_router(test_recommend.router)
app.include_router(summarize.router)

# Try to add main recommend router if dependencies are available
try:
    from app.api import recommend
    app.include_router(recommend.router)
    print("Main recommend router loaded successfully")
except Exception as e:
    print(f"Failed to load recommend router: {e}")
    print("Using test router only")

# Skip thumbnail router for now due to dependency issues