"""Unit tests for the double-submit CSRF rule."""

from unittest.mock import Mock

import pytest
from app.core.dependencies import csrf_protection
from fastapi import HTTPException


def request(method: str = "POST", path: str = "/api/v1/subjects/") -> Mock:
    item = Mock()
    item.method = method
    item.url.path = path
    return item


@pytest.mark.unit
def test_csrf_allows_login_without_token() -> None:
    csrf_protection(request(path="/api/v1/auth/login"), None)


@pytest.mark.unit
def test_csrf_rejects_state_change_without_matching_cookie() -> None:
    item = request()
    item.cookies = {"csrf_token": "cookie-token"}

    with pytest.raises(HTTPException) as error:
        csrf_protection(item, "different-token")

    assert error.value.status_code == 403
