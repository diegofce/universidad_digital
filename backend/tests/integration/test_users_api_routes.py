"""HTTP contracts for administrative user, role and permission operations."""

import pytest


@pytest.mark.integration
def test_admin_can_manage_users_roles_and_permissions(admin_api_client):
    client, _admin, csrf = admin_api_client

    assert client.get("/api/v1/users/roles").status_code == 200
    assert client.get("/api/v1/users/permissions").status_code == 200
    assert client.get("/api/v1/users/").status_code == 200

    created_role = client.post(
        "/api/v1/users/roles",
        headers=csrf,
        json={"name": "qa.reviewer", "description": "QA reviewer"},
    )
    assert created_role.status_code == 201
    role_id = created_role.json()["id"]
    updated_role = client.put(
        f"/api/v1/users/roles/{role_id}",
        headers=csrf,
        json={"description": "Updated reviewer"},
    )
    assert updated_role.status_code == 200
    assert updated_role.json()["description"] == "Updated reviewer"

    created_permission = client.post(
        "/api/v1/users/permissions",
        headers=csrf,
        json={"name": "qa.review", "description": "Review records"},
    )
    assert created_permission.status_code == 201
    permission_id = created_permission.json()["id"]
    updated_permission = client.put(
        f"/api/v1/users/permissions/{permission_id}",
        headers=csrf,
        json={"is_active": False},
    )
    assert updated_permission.status_code == 200
    assert updated_permission.json()["is_active"] is False

    assigned = client.put(
        f"/api/v1/users/roles/{role_id}/permissions",
        headers=csrf,
        json={"permissions": ["roles.manage"]},
    )
    assert assigned.status_code == 200
    assert assigned.json()["permissions"] == ["roles.manage"]

    created_user = client.post(
        "/api/v1/users/",
        headers=csrf,
        json={
            "email": "qa.student@example.com",
            "full_name": "QA Student",
            "password": "student-password-123",
            "roles": ["student"],
            "first_name": "Quinn",
            "last_name": "Student",
            "identification_number": "QA-STUDENT-001",
            "birth_date": "2002-02-02",
            "phone": "+573001234567",
        },
    )
    assert created_user.status_code == 201
    user_id = created_user.json()["id"]
    assert "password_hash" not in created_user.json()
    assert client.get(f"/api/v1/users/{user_id}").status_code == 200
    assert client.get("/api/v1/users/?offset=0&limit=10").status_code == 200

    lookup = client.get(
        "/api/v1/users/lookup", params={"role": "student", "search": "Quinn"}
    )
    assert lookup.status_code == 200
    assert lookup.json() == [
        {
            "id": user_id,
            "display_name": "Quinn Student",
            "email": "qa.student@example.com",
            "role": "student",
        }
    ]
    assert client.get(
        "/api/v1/users/lookup", params={"role": "student", "search": "x"}
    ).status_code == 422
    assert client.get(
        "/api/v1/users/lookup", params={"role": "administrator", "search": "Quinn"}
    ).status_code == 422

    updated_user = client.put(
        f"/api/v1/users/{user_id}",
        headers=csrf,
        json={"full_name": "Updated QA Student", "is_active": False},
    )
    assert updated_user.status_code == 200
    assert updated_user.json()["full_name"] == "Updated QA Student"
    assert client.delete(f"/api/v1/users/{user_id}", headers=csrf).status_code == 204


@pytest.mark.integration
def test_user_administration_enforces_permissions_and_csrf(api_client, valid_user):
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert login.status_code == 200
    assert api_client.get("/api/v1/users/").status_code == 403
    assert api_client.get("/api/v1/users/roles").status_code == 403
    denied = api_client.post(
        "/api/v1/users/roles",
        json={"name": "qa.blocked", "description": "No csrf"},
    )
    assert denied.status_code == 403
    assert denied.json()["detail"] == "CSRF validation failed"
