"""Unit tests for security helpers and authentication decisions."""

from unittest.mock import Mock, patch

import pytest
from app.auth.services import authenticate
from app.core.errors import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.users.models import User


@pytest.mark.unit
def test_password_hash_is_not_reversible() -> None:
    hashed = hash_password("correct-password-123")

    assert hashed != "correct-password-123"
    assert verify_password("correct-password-123", hashed)
    assert not verify_password("wrong-password", hashed)


@pytest.mark.unit
def test_authentication_uses_dummy_hash_for_unknown_email() -> None:
    database = Mock()
    database.scalar.return_value = None

    with patch("app.auth.services.verify_password", return_value=False) as verify:
        with pytest.raises(AppError) as error:
            authenticate(database, "unknown@example.com", "wrong-password")

    assert error.value.status_code == 401
    verify.assert_called_once()


@pytest.mark.unit
def test_authentication_rejects_inactive_user() -> None:
    database = Mock()
    database.scalar.return_value = User(
        email="inactive@example.com",
        full_name="Inactive",
        password_hash="stored-hash",
        is_active=False,
    )

    with patch("app.auth.services.verify_password", return_value=True):
        with pytest.raises(AppError, match="Invalid credentials"):
            authenticate(database, "inactive@example.com", "password")


@pytest.mark.unit
def test_access_token_contains_subject() -> None:
    import jwt
    from app.core.config import settings

    token = create_access_token("student@example.com")

    assert (
        jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])[
            "sub"
        ]
        == "student@example.com"
    )
