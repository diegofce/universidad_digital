"""Isolated authentication decision tests."""

from unittest.mock import Mock, patch

import pytest
from app.auth.services import authenticate
from app.core.errors import AppError
from app.users.models import User


@pytest.mark.unit
def test_authentication_rehashes_outdated_password_and_issues_access_token():
    user = User(
        email="STUDENT@example.com",
        full_name="Student",
        password_hash="old-hash",
        is_active=True,
    )
    database = Mock()
    database.scalar.return_value = user
    with (
        patch("app.auth.services.verify_password", return_value=True),
        patch("app.auth.services.needs_password_rehash", return_value=True),
        patch("app.auth.services.hash_password", return_value="new-hash") as hash_password,
        patch("app.auth.services.create_access_token", return_value="issued-token"),
    ):
        authenticated_user, token = authenticate(database, "STUDENT@EXAMPLE.COM", "password")

    assert authenticated_user is user
    assert token == "issued-token"
    assert user.password_hash == "new-hash"
    hash_password.assert_called_once_with("password")
    database.commit.assert_called_once_with()


@pytest.mark.unit
def test_authentication_rejects_valid_password_for_inactive_account():
    user = User(
        email="inactive@example.com",
        full_name="Inactive",
        password_hash="current-hash",
        is_active=False,
    )
    database = Mock()
    database.scalar.return_value = user
    with patch("app.auth.services.verify_password", return_value=True):
        with pytest.raises(AppError) as error:
            authenticate(database, "inactive@example.com", "password")

    assert error.value.status_code == 401
    database.commit.assert_not_called()
