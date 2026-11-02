"""API and serialization integration tests."""

import pytest


@pytest.mark.integration
def test_login_sets_http_only_access_cookie_and_me_returns_profile(
    api_client, valid_user
):
    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "correct-password-123"},
    )

    assert response.status_code == 200, response.text
    assert response.cookies.get("access_token")
    assert "HttpOnly" in response.headers["set-cookie"]
    profile = api_client.get("/api/v1/auth/me")
    assert profile.status_code == 200
    assert profile.json()["identification_number"] == "STUDENT-001"
    assert "password_hash" not in profile.json()


@pytest.mark.integration
def test_state_changing_endpoint_requires_csrf(api_client, valid_user):
    api_client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "correct-password-123"},
    )

    response = api_client.post("/api/v1/auth/logout")

    assert response.status_code == 403


@pytest.mark.integration
def test_login_rejects_invalid_credentials(api_client, valid_user):
    response = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "incorrect-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.integration
@pytest.mark.xfail(
    strict=True,
    reason=(
        "logout mutates the injected Response but returns a new Response "
        "without deletion cookies"
    ),
)
def test_logout_clears_authentication_cookies(api_client, valid_user):
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert login.status_code == 200
    assert api_client.get("/api/v1/auth/me").status_code == 200
    csrf_token = api_client.cookies.get("csrf_token")
    logout = api_client.post(
        "/api/v1/auth/logout", headers={"X-CSRF-Token": csrf_token}
    )
    assert logout.status_code == 204
    assert api_client.get("/api/v1/auth/me").status_code == 401
