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
