"""Authentication use cases."""

from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    dummy_password_hash,
    hash_password,
    needs_password_rehash,
    verify_password,
)
from app.users.models import User
from sqlalchemy import select
from sqlalchemy.orm import Session


def authenticate(db: Session, email: str, password: str) -> tuple[User, str]:
    """Validate credentials and issue an access token."""
    user = db.scalar(select(User).where(User.email == email.lower()))
    stored_hash = user.password_hash if user is not None else dummy_password_hash
    valid_password = verify_password(password, stored_hash)
    if user is None or not user.is_active or not valid_password:
        raise AppError("Invalid credentials", 401)
    if needs_password_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        db.commit()
    return user, create_access_token(user.email)
