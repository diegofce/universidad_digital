"""SQLite-backed rule tests for academic services; no external database is used."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from app.core.errors import AppError
from app.enrollments.models import EnrollmentStatus
from app.enrollments.schemas import (
    EnrollmentCreate,
    EnrollmentUpdate,
    PeriodCreate,
    PeriodUpdate,
)
from app.enrollments.services import (
    create_enrollment,
    create_period,
    delete_enrollment,
    delete_period,
    get_enrollment,
    get_period,
    list_enrollments,
    list_periods,
    update_enrollment,
    update_period,
)
from app.grades.schemas import GradeCreate, GradeUpdate
from app.grades.services import (
    calculate_weighted_average,
    create_grade,
    delete_grade,
    get_grade,
    list_grades,
    update_grade,
)
from app.subjects.schemas import SubjectCreate, SubjectUpdate
from app.subjects.services import (
    create_subject,
    delete_subject,
    get_subject,
    list_subjects,
    update_subject,
)
from app.users.models import User, UserRole
from sqlalchemy.exc import IntegrityError

from tests.factories.academic import create_enrollment as enrollment_factory
from tests.factories.academic import create_subject as subject_factory


def create_teacher(db_session, role):
    teacher = User(
        email="teacher@example.com",
        full_name="Teacher Example",
        password_hash="not-used",
        roles=[UserRole(role=role)],
    )
    db_session.add(teacher)
    db_session.commit()
    return teacher


def period_data(name="2026-1"):
    return PeriodCreate(
        name=name, starts_on=date(2026, 1, 1), ends_on=date(2026, 6, 30)
    )


@pytest.mark.integration
def test_subject_create_update_listing_and_visibility_rules(db_session, seeded_roles):
    teacher = create_teacher(db_session, seeded_roles["teacher"])
    created = create_subject(
        db_session,
        SubjectCreate(
            code="bio-101",
            name="Biology",
            description="Cell biology",
            credits=4,
            teacher_id=teacher.id,
        ),
    )
    assert created.code == "BIO-101"
    assert get_subject(db_session, created.id, teacher_id=teacher.id) == created
    with pytest.raises(AppError, match="Subject not found"):
        get_subject(db_session, created.id, teacher_id=teacher.id + 1)

    inactive = subject_factory(db_session, code="HIST-101")
    inactive.is_active = False
    db_session.commit()
    with pytest.raises(AppError, match="Subject not found"):
        get_subject(db_session, inactive.id)
    assert get_subject(db_session, inactive.id, include_inactive=True) == inactive

    visible = list_subjects(db_session, teacher_id=teacher.id)
    assert [item.id for item in visible] == [created.id]
    assert inactive.id not in [item.id for item in list_subjects(db_session)]
    assert inactive in list_subjects(db_session, include_inactive=True)

    updated = update_subject(
        db_session, created.id, SubjectUpdate(name="Cell Biology", teacher_id=None)
    )
    assert updated.name == "Cell Biology"
    assert updated.teacher_id is None
    with pytest.raises(AppError, match="Teacher not found"):
        update_subject(db_session, created.id, SubjectUpdate(teacher_id=9999))
    with pytest.raises(AppError, match="Subject code already exists"):
        update_subject(db_session, created.id, SubjectUpdate(code="HIST-101"))
    with pytest.raises(AppError, match="Subject not found"):
        get_subject(db_session, 9999)
    with pytest.raises(AppError, match="Subject not found"):
        delete_subject(db_session, 9999)

    delete_subject(db_session, created.id)
    assert get_subject(db_session, created.id, include_inactive=True).is_active is False


@pytest.mark.integration
def test_subject_rejects_inactive_or_non_teacher_accounts(db_session, seeded_roles):
    inactive_teacher = create_teacher(db_session, seeded_roles["teacher"])
    inactive_teacher.is_active = False
    db_session.commit()
    with pytest.raises(AppError, match="Teacher not found"):
        create_subject(
            db_session,
            SubjectCreate(code="A-1", name="A", credits=1, teacher_id=inactive_teacher.id),
        )

    student = User(
        email="not-teacher@example.com",
        full_name="Student Example",
        password_hash="not-used",
        roles=[UserRole(role=seeded_roles["student"])],
    )
    db_session.add(student)
    db_session.commit()
    with pytest.raises(AppError, match="not a teacher"):
        create_subject(
            db_session,
            SubjectCreate(code="A-2", name="A", credits=1, teacher_id=student.id),
        )

    subject_factory(db_session, code="UNIQUE-1")
    with pytest.raises(AppError, match="Subject code already exists"):
        create_subject(
            db_session,
            SubjectCreate(code="unique-1", name="Duplicate", credits=2),
        )


@pytest.mark.integration
def test_period_lifecycle_and_referenced_period_cannot_be_deleted(
    db_session, valid_user
):
    created = create_period(db_session, period_data())
    assert get_period(db_session, created.id) == created
    assert list_periods(db_session) == [created]
    with pytest.raises(AppError, match="Period name already exists"):
        create_period(db_session, period_data())
    with pytest.raises(AppError, match="Period not found"):
        get_period(db_session, 9999)

    updated = update_period(
        db_session,
        created.id,
        PeriodUpdate(starts_on=date(2026, 2, 1), ends_on=date(2026, 7, 1)),
    )
    assert (updated.starts_on, updated.ends_on) == (date(2026, 2, 1), date(2026, 7, 1))
    create_period(db_session, period_data("2026-2"))
    with pytest.raises(AppError, match="Period name already exists"):
        update_period(db_session, created.id, PeriodUpdate(name="2026-2"))
    with pytest.raises(AppError, match="Invalid period dates"):
        update_period(db_session, created.id, PeriodUpdate(ends_on=date(2026, 1, 1)))
    with pytest.raises(AppError, match="Period not found"):
        update_period(db_session, 9999, PeriodUpdate(name="Missing"))

    subject = subject_factory(db_session)
    enrollment_factory(db_session, valid_user.id, subject.id, created.id)
    with pytest.raises(AppError, match="Period is in use"):
        delete_period(db_session, created.id)
    with pytest.raises(AppError, match="Period not found"):
        delete_period(db_session, 9999)


@pytest.mark.integration
def test_enrollment_creation_validates_actor_student_subject_period_and_credit_limit(
    db_session, valid_user, seeded_roles
):
    period = create_period(db_session, period_data())
    subject = subject_factory(db_session, code="CREDITS-3", credits=3)
    data = EnrollmentCreate(
        student_id=valid_user.id, subject_id=subject.id, period_id=period.id
    )

    with pytest.raises(AppError, match="another student") as forbidden:
        create_enrollment(db_session, data, actor_id=valid_user.id + 1)
    assert forbidden.value.status_code == 403
    created = create_enrollment(db_session, data, actor_id=valid_user.id)
    assert created.status == EnrollmentStatus.ACTIVE
    with pytest.raises(AppError, match="Enrollment already exists"):
        create_enrollment(db_session, data, actor_id=valid_user.id)

    second_subject = subject_factory(db_session, code="CREDITS-27", credits=27)
    create_enrollment(
        db_session,
        EnrollmentCreate(
            student_id=valid_user.id,
            subject_id=second_subject.id,
            period_id=period.id,
        ),
        actor_id=valid_user.id,
    )
    last_credit = subject_factory(db_session, code="CREDITS-1", credits=1)
    with pytest.raises(AppError, match="Credit limit exceeded"):
        create_enrollment(
            db_session,
            EnrollmentCreate(
                student_id=valid_user.id,
                subject_id=last_credit.id,
                period_id=period.id,
            ),
            actor_id=valid_user.id,
        )

    with pytest.raises(AppError, match="Student not found"):
        create_enrollment(
            db_session,
            EnrollmentCreate(student_id=9999, subject_id=subject.id, period_id=period.id),
        )
    inactive_user = User(
        email="inactive-student@example.com",
        full_name="Inactive Student",
        password_hash="unused",
        is_active=False,
        roles=[UserRole(role=seeded_roles["student"])],
    )
    db_session.add(inactive_user)
    db_session.commit()
    with pytest.raises(AppError, match="Student not found"):
        create_enrollment(
            db_session,
            EnrollmentCreate(
                student_id=inactive_user.id, subject_id=subject.id, period_id=period.id
            ),
        )

    non_student = User(
        email="teacher-enroll@example.com",
        full_name="Non Student",
        password_hash="unused",
        roles=[UserRole(role=seeded_roles["teacher"])],
    )
    db_session.add(non_student)
    db_session.commit()
    with pytest.raises(AppError, match="not a student"):
        create_enrollment(
            db_session,
            EnrollmentCreate(
                student_id=non_student.id, subject_id=subject.id, period_id=period.id
            ),
        )
    with pytest.raises(AppError, match="Subject not found"):
        create_enrollment(
            db_session,
            EnrollmentCreate(student_id=valid_user.id, subject_id=9999, period_id=period.id),
        )
    with pytest.raises(AppError, match="Period not found"):
        create_enrollment(
            db_session,
            EnrollmentCreate(student_id=valid_user.id, subject_id=subject.id, period_id=9999),
        )


@pytest.mark.integration
def test_enrollment_visibility_updates_and_cancellation(db_session, valid_user, seeded_roles):
    teacher = create_teacher(db_session, seeded_roles["teacher"])
    subject = subject_factory(db_session, teacher_id=teacher.id)
    period = create_period(db_session, period_data())
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    other_student = User(
        email="other-student@example.com",
        full_name="Other Student",
        password_hash="unused",
        roles=[UserRole(role=seeded_roles["student"])],
    )
    db_session.add(other_student)
    db_session.commit()

    assert get_enrollment(db_session, enrollment.id) == enrollment
    assert list_enrollments(db_session, valid_user.id, admin=False) == [enrollment]
    assert list_enrollments(db_session, valid_user.id, admin=True) == [enrollment]
    assert list_enrollments(db_session, other_student.id, admin=False) == []
    assert list_enrollments(db_session, teacher.id, admin=False, teacher_id=teacher.id) == [enrollment]
    with pytest.raises(AppError, match="Enrollment not found"):
        get_enrollment(db_session, 9999)

    with pytest.raises(AppError, match="Insufficient permissions"):
        update_enrollment(
            db_session,
            enrollment.id,
            EnrollmentUpdate(status=EnrollmentStatus.COMPLETED),
            actor_id=other_student.id,
            admin=False,
        )
    updated = update_enrollment(
        db_session,
        enrollment.id,
        EnrollmentUpdate(status=EnrollmentStatus.COMPLETED),
        actor_id=teacher.id,
        admin=False,
        teacher_id=teacher.id,
    )
    assert updated.status == EnrollmentStatus.COMPLETED
    with pytest.raises(AppError, match="Insufficient permissions"):
        delete_enrollment(db_session, enrollment.id, other_student.id, admin=False)
    delete_enrollment(db_session, enrollment.id, valid_user.id, admin=False)
    assert get_enrollment(db_session, enrollment.id).status == EnrollmentStatus.CANCELLED


@pytest.mark.integration
def test_grade_access_scoping_updates_deletion_and_empty_average(
    db_session, valid_user, seeded_roles
):
    teacher = create_teacher(db_session, seeded_roles["teacher"])
    period = create_period(db_session, period_data())
    subject = subject_factory(db_session, teacher_id=teacher.id, credits=2)
    enrollment = enrollment_factory(db_session, valid_user.id, subject.id, period.id)
    grade = create_grade(
        db_session,
        GradeCreate(enrollment_id=enrollment.id, score=Decimal("4.00"), assessment="Exam"),
        teacher_id=teacher.id,
    )
    assert get_grade(db_session, grade.id, actor_id=valid_user.id) == grade
    assert get_grade(db_session, grade.id, teacher_id=teacher.id) == grade
    assert get_grade(db_session, grade.id, admin=True) == grade
    with pytest.raises(AppError, match="Grade not found"):
        get_grade(db_session, grade.id, actor_id=valid_user.id + 1)
    with pytest.raises(AppError, match="Grade not found"):
        get_grade(db_session, 9999, admin=True)
    assert list_grades(db_session, student_id=valid_user.id) == [grade]
    assert list_grades(db_session, teacher_id=teacher.id) == [grade]
    assert list_grades(db_session) == [grade]
    assert calculate_weighted_average(db_session, valid_user.id, period.id) == Decimal("4.00")
    assert calculate_weighted_average(db_session, valid_user.id + 1) is None

    with pytest.raises(AppError, match="not assigned"):
        create_grade(
            db_session,
            GradeCreate(enrollment_id=enrollment.id, score=Decimal("2.00"), assessment="Quiz"),
            teacher_id=teacher.id + 1,
        )
    with pytest.raises(AppError, match="Enrollment not found"):
        create_grade(
            db_session,
            GradeCreate(enrollment_id=9999, score=Decimal("2.00"), assessment="Quiz"),
            admin=True,
        )
    with pytest.raises(AppError, match="not assigned"):
        create_grade(
            db_session,
            GradeCreate(enrollment_id=enrollment.id, score=Decimal("2.00"), assessment="Quiz"),
        )

    changed = update_grade(
        db_session,
        grade.id,
        GradeUpdate(score=Decimal("5.00"), assessment="Final"),
        teacher_id=teacher.id,
    )
    assert (changed.score, changed.assessment) == (Decimal("5.00"), "Final")
    assert calculate_weighted_average(
        db_session, valid_user.id, period_id=period.id, teacher_id=teacher.id
    ) == Decimal("5.00")
    with pytest.raises(AppError, match="Grade not found"):
        update_grade(db_session, 9999, GradeUpdate(score=Decimal("1.00")), admin=True)
    database = Mock()
    with patch("app.grades.services.get_grade", return_value=grade) as get_authorized_grade:
        delete_grade(database, grade.id)
    get_authorized_grade.assert_called_once_with(database, grade.id)
    database.delete.assert_called_once_with(grade)
    database.commit.assert_called_once_with()


@pytest.mark.unit
@pytest.mark.parametrize("operation", ["create", "update"])
def test_grade_write_integrity_errors_roll_back_and_become_conflicts(operation):
    database = Mock()
    database.commit.side_effect = IntegrityError("write", {}, RuntimeError("constraint"))
    if operation == "create":
        database.get.return_value = SimpleNamespace(
            id=9, subject=SimpleNamespace(teacher_id=3)
        )
        with pytest.raises(AppError, match="Unable to create grade") as error:
            create_grade(
                database,
                GradeCreate(
                    enrollment_id=9,
                    score=Decimal("3.00"),
                    assessment="Conflicting grade",
                ),
                admin=True,
            )
        assert error.value.status_code == 409
    else:
        with patch(
            "app.grades.services.get_grade",
            return_value=SimpleNamespace(score=Decimal("2.00"), assessment="Old"),
        ):
            with pytest.raises(AppError, match="Unable to update grade") as error:
                update_grade(
                    database,
                    9,
                    GradeUpdate(score=Decimal("3.00")),
                    admin=True,
                )
        assert error.value.status_code == 409
    database.rollback.assert_called_once_with()
