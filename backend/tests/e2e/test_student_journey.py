"""Complete user journey through the public HTTP boundary."""

import pytest
from tests.factories.academic import create_period, create_subject


@pytest.mark.e2e
def test_student_logs_in_and_enrolls_in_a_subject(api_client, db_session, valid_user):
    period = create_period(db_session, "2026-e2e")
    subject = create_subject(db_session, code="E2E-101")

    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": "student@example.com", "password": "correct-password-123"},
    )
    csrf_token = api_client.cookies.get("csrf_token")
    response = api_client.post(
        "/api/v1/enrollments/",
        json={
            "student_id": valid_user.id,
            "subject_id": subject.id,
            "period_id": period.id,
        },
        headers={"X-CSRF-Token": csrf_token},
    )

    assert login.status_code == 200, login.text
    assert response.status_code == 201, response.text
    assert response.json()["subject_id"] == subject.id
    assert (
        api_client.get("/api/v1/enrollments/").json()[0]["student_id"] == valid_user.id
    )
