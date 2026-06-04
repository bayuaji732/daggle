from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.auth import router as auth_router
from app.api.datasets import router as datasets_router

app = FastAPI(
    title="Daggle API",
    description="Dataset infrastructure for ML notebooks",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Session middleware (must be added before CORS) ────────────
# Stores OIDC tokens server-side via signed cookie — never exposed to JS
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY,
    session_cookie=settings.SESSION_COOKIE_NAME,
    max_age=settings.SESSION_MAX_AGE,
    https_only=False,  # set True in production
    same_site="lax",
)

# -- CORS ----------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,  # required for session cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(datasets_router, prefix="/api")


# ── Startup ───────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    init_db()


# ── Health ────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy", "service": "daggle-backend"}
