"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from app.auth.routes import router as auth_router
from app.core.config import settings
from app.core.database import create_tables
from app.core.errors import register_error_handlers
from app.enrollments.routes import router as enrollments_router
from app.grades.routes import router as grades_router
from app.subjects.routes import router as subjects_router
from app.users.routes import router as users_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Initialize database objects when the application starts."""
    create_tables()
    yield


app = FastAPI(
    title="University Academic Management API",
    version="1.0.0",
    lifespan=lifespan,
)
register_error_handlers(app)
if settings.allowed_host_list != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(subjects_router, prefix="/api/v1")
app.include_router(enrollments_router, prefix="/api/v1")
app.include_router(grades_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Report process health without exposing infrastructure details."""
    return {"status": "ok"}
