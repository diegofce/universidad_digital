"""Login and logout endpoints."""

from typing import Annotated

from app.auth.services import authenticate
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import csrf_protection, current_user
from app.core.security import create_csrf_token
from app.users.models import User
from app.users.schemas import LoginRequest, UserResponse
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/auth", tags=["auth"], dependencies=[Depends(csrf_protection)]
)
Db = Annotated[Session, Depends(get_db)]
Actor = Annotated[User, Depends(current_user)]


@router.get("/me", response_model=UserResponse)
def me(actor: Actor) -> User:
    """Return the authenticated user's public profile."""
    return actor


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, response: Response, db: Db) -> User:
    user, token = authenticate(db, str(data.email), data.password)
    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expiration_minutes * 60,
        path="/",
    )
    response.set_cookie(
        "csrf_token",
        create_csrf_token(),
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expiration_minutes * 60,
        path="/",
    )
    return user


@router.post("/logout", status_code=204)
def logout(response: Response) -> Response:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("csrf_token", path="/")
    return Response(status_code=204)
