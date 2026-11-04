"""HTTP-level academic contracts using the per-test in-memory SQLite database."""

import pytest
from decimal import Decimal

from app.enrollments.models import EnrollmentStatus
from app.core.security import hash_password
from app.grades.models import Grade
from app.grades.schemas import GradeCreate
from app.grades.services import create_grade
from app.users.models import Permission, Role, RolePermission, User, UserRole

from tests.factories.academic import create_enrollment as enrollment_factory
from tests.factories.academic import create_period as period_factory
from tests.factories.academic import create_subject as subject_factory


def csrf(client):
    return {"X-CSRF-Token": client.cookies.get("csrf_token")}


@pytest.mark.integration
def test_subject_routes_apply_admin_and_teacher_visibility(admin_api_client, api_client, valid_user, db_session, seeded_roles):
    admin, _admin_user, admin_csrf = admin_api_client
    teacher = User(
        email="subject-teacher@example.com",
        full_name="Subject Teacher",
        password_hash=hash_password("teacher-password-123"),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    db_session.add(teacher)
    db_session.commit()

    created = admin.post(
        "/api/v1/subjects/",
        headers=admin_csrf,
        json={
            "code": "ROUTE-101",
            "name": "Route Testing",
            "description": None,
            "credits": 3,
            "teacher_id": teacher.id,
        },
    )
    assert created.status_code == 201
    subject_id = created.json()["id"]
    assert admin.get("/api/v1/subjects/").json()[0]["id"] == subject_id
    assert admin.get(f"/api/v1/subjects/{subject_id}").status_code == 200
    assert admin.put(
        f"/api/v1/subjects/{subject_id}",
        headers=admin_csrf,
        json={"name": "Updated Route Testing"},
    ).json()["name"] == "Updated Route Testing"

    teacher_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": teacher.email, "password": "teacher-password-123"},
    )
    assert teacher_login.status_code == 200
    assert [row["id"] for row in api_client.get("/api/v1/subjects/").json()] == [subject_id]
    assert api_client.get(f"/api/v1/subjects/{subject_id}").status_code == 200
    assert api_client.get(f"/api/v1/subjects/{subject_id + 999}").status_code == 404

    student_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert student_login.status_code == 200
    assert api_client.get("/api/v1/subjects/").status_code == 200
    assert api_client.post(
        "/api/v1/subjects/",
        json={"code": "DENIED", "name": "Denied", "credits": 1},
        headers=csrf(api_client),
    ).status_code == 403

    deleted = admin.delete(f"/api/v1/subjects/{subject_id}", headers=admin_csrf)
    assert deleted.status_code == 204, deleted.text
    assert admin.get(f"/api/v1/subjects/{subject_id}").status_code == 200
    assert admin.delete("/api/v1/subjects/99999", headers=admin_csrf).status_code == 404


@pytest.mark.integration
def test_period_and_enrollment_routes_enforce_ownership_and_roles(
    admin_api_client, api_client, valid_user, db_session, seeded_roles
):
    admin, _admin_user, admin_csrf = admin_api_client
    teacher = User(
        email="enrollment-teacher@example.com",
        full_name="Enrollment Teacher",
        password_hash=hash_password("teacher-password-123"),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    db_session.add(teacher)
    db_session.commit()
    period = admin.post(
        "/api/v1/periods/",
        headers=admin_csrf,
        json={"name": "2027-A", "starts_on": "2027-01-01", "ends_on": "2027-06-30"},
    )
    assert period.status_code == 201
    period_id = period.json()["id"]
    assert admin.get("/api/v1/periods/").status_code == 200
    assert admin.put(
        f"/api/v1/periods/{period_id}",
        headers=admin_csrf,
        json={"name": "2027-B"},
    ).status_code == 200

    subject = admin.post(
        "/api/v1/subjects/",
        headers=admin_csrf,
        json={
            "code": "ENROLL-101",
            "name": "Enrollment",
            "credits": 3,
            "teacher_id": teacher.id,
        },
    )
    assert subject.status_code == 201
    student_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert student_login.status_code == 200
    enrollment_data = {
        "student_id": valid_user.id,
        "subject_id": subject.json()["id"],
        "period_id": period_id,
    }
    enrollment = api_client.post(
        "/api/v1/enrollments/", headers=csrf(api_client), json=enrollment_data
    )
    assert enrollment.status_code == 201
    enrollment_id = enrollment.json()["id"]
    assert enrollment.json()["status"] == EnrollmentStatus.ACTIVE.value
    assert api_client.get("/api/v1/enrollments/").json()[0]["id"] == enrollment_id
    assert api_client.get(f"/api/v1/enrollments/{enrollment_id}").status_code == 200
    assert api_client.put(
        f"/api/v1/enrollments/{enrollment_id}",
        headers=csrf(api_client),
        json={"status": "completed"},
    ).status_code == 403

    teacher_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": teacher.email, "password": "teacher-password-123"},
    )
    assert teacher_login.status_code == 200
    assert api_client.get("/api/v1/enrollments/").json()[0]["id"] == enrollment_id
    assert api_client.get(f"/api/v1/enrollments/{enrollment_id}").status_code == 200
    assert api_client.put(
        f"/api/v1/enrollments/{enrollment_id}",
        headers=csrf(api_client),
        json={"status": "completed"},
    ).json()["status"] == "completed"

    assert api_client.post(
        "/api/v1/enrollments/",
        headers=csrf(api_client),
        json=enrollment_data,
    ).status_code == 403

    student_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert student_login.status_code == 200

    outsider = User(
        email="outsider@example.com",
        full_name="Outsider",
        password_hash=hash_password("outsider-password-123"),
        roles=[UserRole(role=seeded_roles["student"])],
    )
    db_session.add(outsider)
    db_session.commit()
    assert api_client.post(
        "/api/v1/auth/login",
        json={"email": outsider.email, "password": "outsider-password-123"},
    ).status_code == 200
    assert api_client.get(f"/api/v1/enrollments/{enrollment_id}").status_code == 404

    assert api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    ).status_code == 200
    assert api_client.delete(
        f"/api/v1/enrollments/{enrollment_id}", headers=csrf(api_client)
    ).status_code == 204
    assert api_client.get(f"/api/v1/enrollments/{enrollment_id}").json()["status"] == "cancelled"

    second_subject = admin.post(
        "/api/v1/subjects/",
        headers=admin_csrf,
        json={"code": "ENROLL-102", "name": "Second Enrollment", "credits": 2},
    )
    assert second_subject.status_code == 201, second_subject.text
    admin_enrollment = admin.post(
        "/api/v1/enrollments/",
        headers=admin_csrf,
        json={**enrollment_data, "subject_id": second_subject.json()["id"]},
    )
    assert admin_enrollment.status_code == 201
    admin_enrollment_id = admin_enrollment.json()["id"]
    assert admin.get(f"/api/v1/enrollments/{admin_enrollment_id}").status_code == 200
    assert admin.put(
        f"/api/v1/enrollments/{admin_enrollment_id}",
        headers=admin_csrf,
        json={"status": "completed"},
    ).json()["status"] == "completed"
    assert admin.delete(
        f"/api/v1/enrollments/{admin_enrollment_id}", headers=admin_csrf
    ).status_code == 204
    assert admin.delete("/api/v1/enrollments/99999", headers=admin_csrf).status_code == 404

    assert admin.delete(f"/api/v1/periods/{period_id}", headers=admin_csrf).status_code == 409
    unused_period = admin.post(
        "/api/v1/periods/",
        headers=admin_csrf,
        json={"name": "2027-unused", "starts_on": "2027-01-01", "ends_on": "2027-06-30"},
    )
    assert unused_period.status_code == 201
    assert admin.delete(
        f"/api/v1/periods/{unused_period.json()['id']}", headers=admin_csrf
    ).status_code == 204
    assert admin.delete("/api/v1/periods/99999", headers=admin_csrf).status_code == 404


@pytest.mark.integration
def test_grade_routes_scope_lists_summaries_and_mutations(
    admin_api_client, api_client, valid_user, db_session, seeded_roles
):
    admin, _admin_user, admin_csrf = admin_api_client
    teacher = User(
        email="grades-teacher@example.com",
        full_name="Grades Teacher",
        password_hash=hash_password("teacher-password-123"),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    db_session.add(teacher)
    db_session.commit()
    period = period_factory(db_session, "2028-G")
    subject = subject_factory(db_session, code="GRADE-101", teacher_id=teacher.id)
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade_data = {
        "enrollment_id": enrollment.id,
        "score": "4.25",
        "assessment": "Midterm",
    }

    student_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert student_login.status_code == 200
    assert api_client.get("/api/v1/grades/").json() == []
    assert api_client.get(
        f"/api/v1/grades/summary/{valid_user.id}"
    ).json()["weighted_average"] is None
    assert api_client.get(
        f"/api/v1/grades/summary/{valid_user.id + 1}"
    ).status_code == 404
    assert api_client.get(
        f"/api/v1/grades/summary/{valid_user.id}?period_id=0"
    ).status_code == 422
    assert api_client.post(
        "/api/v1/grades/", headers=csrf(api_client), json=grade_data
    ).status_code == 403

    student_role = seeded_roles["student"]
    grade_permission = db_session.query(Permission).filter_by(name="grades.manage").one()
    student_role.permissions.append(RolePermission(permission=grade_permission))
    db_session.commit()
    assert api_client.post(
        "/api/v1/grades/", headers=csrf(api_client), json=grade_data
    ).status_code == 403

    teacher_login = api_client.post(
        "/api/v1/auth/login",
        json={"email": teacher.email, "password": "teacher-password-123"},
    )
    assert teacher_login.status_code == 200
    created = api_client.post(
        "/api/v1/grades/", headers=csrf(api_client), json=grade_data
    )
    assert created.status_code == 201
    grade_id = created.json()["id"]
    assert api_client.get("/api/v1/grades/").json()[0]["id"] == grade_id
    assert api_client.get(f"/api/v1/grades/{grade_id}").status_code == 200
    assert api_client.get(
        f"/api/v1/grades/summary/{valid_user.id}?period_id={period.id}"
    ).json()["weighted_average"] == "4.25"
    updated = api_client.put(
        f"/api/v1/grades/{grade_id}",
        headers=csrf(api_client),
        json={"assessment": "Final"},
    )
    assert updated.status_code == 200
    assert updated.json()["assessment"] == "Final"

    admin_grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("3.00"),
            assessment="Admin assessment",
        ),
        admin=True,
    )
    assert admin.get("/api/v1/grades/").status_code == 200
    assert admin.get(f"/api/v1/grades/{admin_grade.id}").status_code == 200
    assert admin.get(f"/api/v1/grades/summary/{valid_user.id}").status_code == 200
    assert admin.put(
        f"/api/v1/grades/{admin_grade.id}",
        headers=admin_csrf,
        json={"score": "3.50"},
    ).json()["score"] == "3.50"

    deleted = admin.delete(
        f"/api/v1/grades/{admin_grade.id}", headers=admin_csrf
    )
    assert deleted.status_code == 204
    assert db_session.get(Grade, admin_grade.id) is None


@pytest.mark.integration
def test_admin_and_teacher_roles_keep_global_grade_delete_scope(
    admin_api_client, db_session, valid_user, seeded_roles
):
    admin, admin_user, admin_csrf = admin_api_client
    admin_user.roles.append(UserRole(role=seeded_roles["teacher"]))
    db_session.commit()
    assigned_teacher = User(
        email="different-grade-teacher@example.com",
        full_name="Different Grade Teacher",
        password_hash=hash_password("different-teacher-password-123"),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    db_session.add(assigned_teacher)
    db_session.commit()
    period = period_factory(db_session, "2028-DELETE")
    subject = subject_factory(
        db_session, code="GRADE-DEL", teacher_id=assigned_teacher.id
    )
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("2.00"),
            assessment="Delete target",
        ),
        admin=True,
    )
    response = admin.delete(f"/api/v1/grades/{grade.id}", headers=admin_csrf)
    assert response.status_code == 204
    assert db_session.get(Grade, grade.id) is None


@pytest.mark.integration
def test_assigned_teacher_can_delete_grade_and_persist_removal(
    api_client, db_session, valid_user, seeded_roles
):
    teacher = User(
        email="deleting-teacher@example.com",
        full_name="Deleting Teacher",
        password_hash=hash_password("deleting-teacher-password-123"),
        roles=[
            UserRole(role=seeded_roles["teacher"]),
            UserRole(role=seeded_roles["student"]),
        ],
    )
    db_session.add(teacher)
    db_session.commit()
    period = period_factory(db_session, "2028-TEACHER-DELETE")
    subject = subject_factory(
        db_session, code="GRADE-TEACHER-DEL", teacher_id=teacher.id
    )
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("3.25"),
            assessment="Teacher delete target",
        ),
        teacher_id=teacher.id,
    )
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": teacher.email, "password": "deleting-teacher-password-123"},
    )
    assert login.status_code == 200

    response = api_client.delete(
        f"/api/v1/grades/{grade.id}", headers=csrf(api_client)
    )

    assert response.status_code == 204
    assert db_session.get(Grade, grade.id) is None


@pytest.mark.integration
def test_unassigned_teacher_cannot_delete_grade(
    api_client, db_session, valid_user, seeded_roles
):
    assigned_teacher = User(
        email="assigned-grade-teacher@example.com",
        full_name="Assigned Grade Teacher",
        password_hash=hash_password("assigned-grade-password-123"),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    other_teacher = User(
        email="other-grade-teacher@example.com",
        full_name="Other Grade Teacher",
        password_hash=hash_password("other-grade-password-123"),
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    db_session.add_all([assigned_teacher, other_teacher])
    db_session.commit()
    period = period_factory(db_session, "2028-OTHER-TEACHER-DELETE")
    subject = subject_factory(
        db_session, code="GRADE-OTHER-TEACHER", teacher_id=assigned_teacher.id
    )
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("3.75"),
            assessment="Out of scope delete target",
        ),
        teacher_id=assigned_teacher.id,
    )
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": other_teacher.email, "password": "other-grade-password-123"},
    )
    assert login.status_code == 200

    response = api_client.delete(
        f"/api/v1/grades/{grade.id}", headers=csrf(api_client)
    )

    assert response.status_code == 404
    assert db_session.get(Grade, grade.id) is not None


@pytest.mark.integration
def test_student_with_grades_manage_cannot_delete_grade(
    api_client, db_session, valid_user, seeded_roles
):
    permission = db_session.query(Permission).filter_by(name="grades.manage").one()
    seeded_roles["student"].permissions.append(
        RolePermission(permission=permission)
    )
    db_session.commit()
    period = period_factory(db_session, "2028-STUDENT-DELETE")
    subject = subject_factory(db_session, code="GRADE-STUDENT-DEL")
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("2.75"),
            assessment="Student delete target",
        ),
        admin=True,
    )
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert login.status_code == 200

    response = api_client.delete(
        f"/api/v1/grades/{grade.id}", headers=csrf(api_client)
    )

    assert response.status_code == 403
    assert db_session.get(Grade, grade.id) is not None


@pytest.mark.integration
def test_user_with_non_staff_role_and_grades_manage_cannot_delete_grade(
    api_client, db_session, valid_user
):
    permission = db_session.query(Permission).filter_by(name="grades.manage").one()
    observer_role = Role(name="grade-observer", description="Non-staff role")
    observer_role.permissions.append(RolePermission(permission=permission))
    observer = User(
        email="grade-observer@example.com",
        full_name="Grade Observer",
        password_hash=hash_password("grade-observer-password-123"),
        roles=[UserRole(role=observer_role)],
    )
    db_session.add(observer)
    db_session.commit()
    period = period_factory(db_session, "2028-OBSERVER-DELETE")
    subject = subject_factory(db_session, code="GRADE-OBSERVER-DEL")
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("3.00"),
            assessment="Observer delete target",
        ),
        admin=True,
    )
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": observer.email, "password": "grade-observer-password-123"},
    )
    assert login.status_code == 200

    response = api_client.delete(
        f"/api/v1/grades/{grade.id}", headers=csrf(api_client)
    )

    assert response.status_code == 403
    assert db_session.get(Grade, grade.id) is not None


@pytest.mark.integration
def test_user_without_grades_manage_cannot_delete_grade(
    api_client, db_session, valid_user, monkeypatch
):
    period = period_factory(db_session, "2028-NO-PERMISSION-DELETE")
    subject = subject_factory(db_session, code="GRADE-NO-PERMISSION-DEL")
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(
            enrollment_id=enrollment.id,
            score=Decimal("2.50"),
            assessment="No permission delete target",
        ),
        admin=True,
    )
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": valid_user.email, "password": "correct-password-123"},
    )
    assert login.status_code == 200
    service_called = False

    def unexpected_service_call(*_args, **_kwargs):
        nonlocal service_called
        service_called = True
        raise AssertionError("delete service must not run without grades.manage")

    monkeypatch.setattr(
        "app.grades.routes.services.delete_grade", unexpected_service_call
    )

    response = api_client.delete(
        f"/api/v1/grades/{grade.id}", headers=csrf(api_client)
    )

    assert response.status_code == 403
    assert not service_called
    assert db_session.get(Grade, grade.id) is not None
