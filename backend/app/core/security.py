"""Password hashing and JWT helpers."""

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from app.core.config import settings
from passlib.context import CryptContext

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
dummy_password_hash = password_context.hash("invalid-user-password")


def hash_password(password: str) -> str:
    """Return a one-way password hash."""
    return password_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its stored hash."""
    return password_context.verify(password, hashed_password)


def needs_password_rehash(hashed_password: str) -> bool:
    """Return whether a stored hash should be upgraded on successful login."""
    return password_context.needs_update(hashed_password)


def create_csrf_token() -> str:
    """Create a random token for double-submit cookie protection."""
    return secrets.token_urlsafe(32)


def create_access_token(subject: str) -> str:
    """Create a short-lived signed access token."""
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_expiration_minutes
    )
    return jwt.encode(
        {"sub": subject, "exp": expires},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
