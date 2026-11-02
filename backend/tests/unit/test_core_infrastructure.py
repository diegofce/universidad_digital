"""Tests for configuration, request dependencies and database lifecycle helpers."""

from unittest.mock import Mock, patch

import pytest
from app.core.config import Settings
from app.core.dependencies import active_role_names, require_permissions, require_roles
from app.core.errors import register_error_handlers
from app.core.security import create_access_token
from app.users.models import Permission, RolePermission
from fastapi import HTTPException
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError


def make_settings(**overrides):
    values = {
        "database_url": "sqlite://",
        "jwt_secret_key": "a-test-secret-that-is-at-least-32-characters",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.unit
def test_settings_normalize_cors_and_allowed_host_lists():
    settings = make_settings(
        cors_origins=" http://one.test, ,http://two.test ",
        allowed_hosts=" api.test, localhost ,",
    )

    assert settings.cors_origin_list == ["http://one.test", "http://two.test"]
    assert settings.allowed_host_list == ["api.test", "localhost"]
    assert make_settings(cors_origins="").cors_origin_list == [
        "http://localhost:3000",
        "http://localhost:5173",
    ]


@pytest.mark.unit
@pytest.mark.parametrize(
    ("options", "message"),
    [
        ({"app_env": "production"}, "APP_COOKIE_SECURE"),
        (
            {"app_env": "production", "cookie_secure": True, "cors_origins": "   "},
            "APP_CORS_ORIGINS",
        ),
    ],
)
def test_production_settings_reject_unsafe_cookie_or_missing_cors(options, message):
    with pytest.raises(ValueError, match=message):
        make_settings(**options)


@pytest.mark.unit
def test_active_role_names_ignores_inactive_role(db_session, valid_user, seeded_roles):
    seeded_roles["student"].is_active = False
    db_session.commit()

    assert active_role_names(valid_user) == set()


@pytest.mark.unit
def test_role_and_permission_dependencies_allow_and_reject(db_session, valid_user, seeded_roles):
    assert require_roles("student")(user=valid_user, db=db_session) is valid_user
    with pytest.raises(HTTPException) as role_denied:
        require_roles("administrator")(user=valid_user, db=db_session)
    assert role_denied.value.status_code == 403

    subjects_permission = db_session.query(Permission).filter_by(name="subjects.manage").one()
    seeded_roles["student"].permissions.append(
        RolePermission(permission=subjects_permission)
    )
    db_session.commit()
    assert require_permissions("subjects.manage")(user=valid_user, db=db_session) is valid_user
    with pytest.raises(HTTPException) as permission_denied:
        require_permissions("roles.manage")(user=valid_user, db=db_session)
    assert permission_denied.value.status_code == 403

    inactive_permission = Permission(name="inactive.permission", description="Inactive", is_active=False)
    db_session.add(inactive_permission)
    db_session.flush()
    seeded_roles["student"].permissions.append(RolePermission(permission=inactive_permission))
    db_session.commit()
    with pytest.raises(HTTPException) as inactive_denied:
        require_permissions("inactive.permission")(user=valid_user, db=db_session)
    assert inactive_denied.value.status_code == 403


@pytest.mark.unit
def test_database_session_is_closed_and_schema_creation_uses_metadata():
    from app.core import database

    session = Mock()
    with patch("app.core.database.SessionLocal", return_value=session):
        generator = database.get_db()
        assert next(generator) is session
        with pytest.raises(StopIteration):
            next(generator)
    session.close.assert_called_once_with()

    with patch("app.core.database.Base.metadata.create_all") as create_all:
        database.create_tables()
    create_all.assert_called_once_with(bind=database.engine)


@pytest.mark.unit
def test_application_lifespan_initializes_tables_and_health_is_available(monkeypatch):
    import app.main as main

    create_tables = Mock()
    monkeypatch.setattr(main, "create_tables", create_tables)
    with TestClient(main.app, base_url="http://localhost") as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    create_tables.assert_called_once_with()


@pytest.mark.unit
def test_current_user_rejects_missing_invalid_and_inactive_cookie(api_client, valid_user, db_session):
    assert api_client.get("/api/v1/auth/me").status_code == 401
    api_client.cookies.set("access_token", "not-a-jwt")
    assert api_client.get("/api/v1/auth/me").json()["detail"] == "Invalid authentication"

    api_client.cookies.set("access_token", create_access_token(valid_user.email))
    valid_user.is_active = False
    db_session.commit()
    assert api_client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.unit
def test_sqlalchemy_error_handler_hides_database_details_from_api_response():
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/database-error")
    def database_error():
        raise SQLAlchemyError("private connection details")

    with TestClient(app) as client:
        response = client.get("/database-error")

    assert response.status_code == 500
    assert response.json() == {"detail": "Database operation failed"}
    assert "private connection details" not in response.text
