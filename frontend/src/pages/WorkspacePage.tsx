import { Pencil, Power, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { unstable_usePrompt, useLocation } from 'react-router-dom';
import type { Enrollment, Grade, Period, Subject, User } from '../api/types';
import { ErrorMessage, Loading } from '../components/feedback/State';
import {
  EnrollmentCreateForm,
  EnrollmentEditForm,
  GradeCreateForm,
  GradeEditForm,
  PeriodCreateForm,
  PeriodEditForm,
  SubjectCreateForm,
  SubjectEditForm,
  UserCreateForm,
  UserEditForm,
} from '../components/forms/CrudForms';
import { RolePermissionsWorkspace } from '../components/forms/RolePermissionsWorkspace';
import { DataTable } from '../components/tables/DataTable';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useEnrollments } from '../hooks/useEnrollments';
import { useGrades } from '../hooks/useGrades';
import { usePeriods } from '../hooks/usePeriods';
import { useSubjects } from '../hooks/useSubjects';
import { useUsers } from '../hooks/useUsers';
import { enrollmentsService } from '../services/enrollments.service';
import { gradesService } from '../services/grades.service';
import { periodsService } from '../services/periods.service';
import { subjectsService } from '../services/subjects.service';
import { usersService } from '../services/users.service';
import { getErrorMessage } from '../utils/errors';
const titles: Record<string, string> = {
  '/admin/users': 'Usuarios',
  '/admin/roles': 'Roles y permisos',
  '/admin/subjects': 'Materias',
  '/admin/periods': 'Periodos',
  '/admin/enrollments': 'Inscripciones',
  '/admin/grades': 'Calificaciones',
  '/admin/audit': 'Auditoría',
  '/teacher/subjects': 'Mis materias',
  '/teacher/enrollments': 'Inscripciones asociadas',
  '/teacher/grades': 'Calificaciones',
  '/student/subjects': 'Materias disponibles',
  '/student/enrollments': 'Mis inscripciones',
  '/student/grades': 'Mis calificaciones',
  '/student/summary': 'Promedio ponderado',
};
export function WorkspacePage() {
  const path = useLocation().pathname;
  const title = titles[path] ?? 'Espacio académico';
  const needsUsers = path === '/admin/users';
  const users = useUsers(needsUsers, true);
  const subjects = useSubjects(path.endsWith('/subjects'));
  const enrollments = useEnrollments(path.endsWith('/enrollments'));
  const grades = useGrades(path.endsWith('/grades') || path.endsWith('/summary'));
  const periods = usePeriods(path.endsWith('/periods') || path === '/admin/enrollments');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { hasPermission, hasRole } = useAuth();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const hasDraft = Boolean(
    editingUser || editingSubject || editingPeriod || editingEnrollment || editingGrade,
  );
  const previousPath = useRef(path);
  unstable_usePrompt({
    when: hasDraft,
    message: '¿Salir sin guardar los cambios?',
  });
  useEffect(() => {
    if (previousPath.current === path) return;
    setEditingUser(null);
    setEditingSubject(null);
    setEditingPeriod(null);
    setEditingEnrollment(null);
    setEditingGrade(null);
    setMessage('');
    previousPath.current = path;
  }, [path]);
  const is = (value: string) => path.endsWith(value);
  const data = is('users')
    ? users
    : is('subjects')
      ? subjects
      : is('enrollments')
        ? enrollments
        : is('periods')
          ? periods
          : grades;
  if (path.endsWith('audit'))
    return (
      <>
        <p className="muted">ADMINISTRACIÓN</p>
        <h1>{title}</h1>
        <section className="panel">
          <h2>Auditoría no disponible</h2>
          <p className="muted">
            El backend actual no expone un endpoint de auditoría. No se muestran datos inventados.
          </p>
        </section>
      </>
    );
  if (path === '/admin/roles')
    return (
      <>
        <p className="muted">ADMINISTRACIÓN</p>
        <h1>{title}</h1>
        <RolePermissionsWorkspace />
      </>
    );
  if (is('summary')) return <Summary />;
  if (data.loading)
    return (
      <>
        <h1>{title}</h1>
        <Loading />
      </>
    );
  if (data.error)
    return (
      <>
        <h1>{title}</h1>
        <ErrorMessage message={getErrorMessage(data.error)} />
      </>
    );
  const createForm =
    path === '/admin/users' ? (
      <UserCreateForm
        busy={busy}
        onSubmit={async (payload) => {
          await runMutation(usersService.create(payload), users.refresh, setMessage, setBusy);
        }}
      />
    ) : path === '/admin/subjects' ? (
      <SubjectCreateForm
        busy={busy}
        onSubmit={async (payload) => {
          await runMutation(subjectsService.create(payload), subjects.refresh, setMessage, setBusy);
        }}
      />
    ) : path === '/admin/periods' ? (
      <PeriodCreateForm
        busy={busy}
        onSubmit={async (payload) => {
          await runMutation(periodsService.create(payload), periods.refresh, setMessage, setBusy);
        }}
      />
    ) : path === '/admin/enrollments' ? (
      <EnrollmentCreateForm
        busy={busy}
        subjects={subjects.data}
        periods={periods.data}
        onSubmit={async (payload) => {
          await runMutation(
            enrollmentsService.create(payload),
            enrollments.refresh,
            setMessage,
            setBusy,
          );
        }}
      />
    ) : path.endsWith('/grades') && hasPermission('grades.manage') ? (
      <GradeCreateForm
        busy={busy}
        enrollments={enrollments.data}
        onSubmit={async (payload) => {
          await runMutation(gradesService.create(payload), grades.refresh, setMessage, setBusy);
        }}
      />
    ) : null;
  const editForm = editingUser ? (
    <UserEditForm
      key={editingUser.id}
      initial={editingUser}
      busy={busy}
      onSubmit={async (payload) => {
        if (
          await runMutation(
            usersService.update(editingUser.id, payload),
            users.refresh,
            setMessage,
            setBusy,
          )
        )
          setEditingUser(null);
      }}
      onCancel={() => setEditingUser(null)}
    />
  ) : editingSubject ? (
    <SubjectEditForm
      key={editingSubject.id}
      initial={editingSubject}
      busy={busy}
      onSubmit={async (payload) => {
        if (
          await runMutation(
            subjectsService.update(editingSubject.id, payload),
            subjects.refresh,
            setMessage,
            setBusy,
          )
        )
          setEditingSubject(null);
      }}
      onCancel={() => setEditingSubject(null)}
    />
  ) : editingPeriod ? (
    <PeriodEditForm
      key={editingPeriod.id}
      initial={editingPeriod}
      busy={busy}
      onSubmit={async (payload) => {
        if (
          await runMutation(
            periodsService.update(editingPeriod.id, payload),
            periods.refresh,
            setMessage,
            setBusy,
          )
        )
          setEditingPeriod(null);
      }}
      onCancel={() => setEditingPeriod(null)}
    />
  ) : editingEnrollment ? (
    <EnrollmentEditForm
      key={editingEnrollment.id}
      initial={editingEnrollment}
      busy={busy}
      onSubmit={async (status) => {
        if (
          await runMutation(
            enrollmentsService.update(editingEnrollment.id, status),
            enrollments.refresh,
            setMessage,
            setBusy,
          )
        )
          setEditingEnrollment(null);
      }}
      onCancel={() => setEditingEnrollment(null)}
    />
  ) : editingGrade ? (
    <GradeEditForm
      key={editingGrade.id}
      initial={editingGrade}
      busy={busy}
      onSubmit={async (payload) => {
        if (
          await runMutation(
            gradesService.update(editingGrade.id, payload),
            grades.refresh,
            setMessage,
            setBusy,
          )
        )
          setEditingGrade(null);
      }}
      onCancel={() => setEditingGrade(null)}
    />
  ) : null;
  const rows = is('users')
    ? users.data.map((item) => [
        item.full_name,
        item.email,
        item.roles.join(', '),
        item.is_active ? <span className="badge">Activo</span> : 'Inactivo',
        <div className="table-actions">
          <Button className="secondary" onClick={() => setEditingUser(item)} disabled={busy}>
            <Pencil size={16} aria-hidden="true" />
            <span className="sr-only">Editar usuario</span>
          </Button>
          {item.is_active && (
            <Button
              className="danger"
              onClick={() => {
                if (window.confirm('¿Desactivar este usuario?'))
                  void runMutation(
                    usersService.deactivate(item.id),
                    users.refresh,
                    setMessage,
                    setBusy,
                  );
              }}
              disabled={busy}
            >
              <Power size={16} aria-hidden="true" />
              <span className="sr-only">Desactivar usuario</span>
            </Button>
          )}
        </div>,
      ])
    : is('subjects')
      ? subjects.data.map((item) => [
          item.code,
          item.name,
          String(item.credits),
          item.teacher_id ? String(item.teacher_id) : 'Sin asignar',
          item.is_active ? 'Activa' : 'Inactiva',
          <div className="table-actions">
            {path === '/admin/subjects' && (
              <Button className="secondary" onClick={() => setEditingSubject(item)} disabled={busy}>
                <Pencil size={16} aria-hidden="true" />
                <span className="sr-only">Editar materia</span>
              </Button>
            )}
            {path === '/admin/subjects' && item.is_active && (
              <Button
                className="danger"
                onClick={() => {
                  if (window.confirm('¿Desactivar esta materia?'))
                    void runMutation(
                      subjectsService.deactivate(item.id),
                      subjects.refresh,
                      setMessage,
                      setBusy,
                    );
                }}
                disabled={busy}
              >
                <Power size={16} aria-hidden="true" />
                <span className="sr-only">Desactivar materia</span>
              </Button>
            )}
            {path === '/admin/subjects' && !item.is_active && (
              <Button className="secondary" onClick={() => setEditingSubject(item)} disabled={busy}>
                <RotateCcw size={16} aria-hidden="true" />
                <span className="sr-only">Reactivar materia</span>
              </Button>
            )}
          </div>,
        ])
      : is('periods')
        ? periods.data.map((item) => [
            item.name,
            item.starts_on,
            item.ends_on,
            path === '/admin/periods' ? (
              <Button className="secondary" onClick={() => setEditingPeriod(item)} disabled={busy}>
                Editar
              </Button>
            ) : null,
          ])
        : is('enrollments')
          ? enrollments.data.map((item) => [
              String(item.id),
              String(item.subject_id),
              String(item.period_id),
              String(item.student_id),
              item.status,
              <div className="table-actions">
                {(hasRole('administrator') || hasRole('teacher')) && (
                  <Button
                    className="secondary"
                    onClick={() => setEditingEnrollment(item)}
                    disabled={busy}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span className="sr-only">Editar inscripción</span>
                  </Button>
                )}
                {item.status !== 'cancelled' && (
                  <Button
                    className="danger"
                    onClick={() => {
                      if (window.confirm('¿Cancelar esta inscripción?'))
                        void runMutation(
                          enrollmentsService.cancel(item.id),
                          enrollments.refresh,
                          setMessage,
                          setBusy,
                        );
                    }}
                    disabled={busy}
                  >
                    <XCircle size={16} aria-hidden="true" />
                    <span className="sr-only">Cancelar inscripción</span>
                  </Button>
                )}
              </div>,
            ])
          : grades.data.map((item) => [
              String(item.id),
              String(item.enrollment_id),
              item.assessment,
              String(item.score),
              <div className="table-actions">
                {hasPermission('grades.manage') && (
                  <Button
                    className="secondary"
                    onClick={() => setEditingGrade(item)}
                    disabled={busy}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span className="sr-only">Editar calificación</span>
                  </Button>
                )}
                {hasPermission('grades.manage') && (
                  <Button
                    className="danger"
                    onClick={() => {
                      if (window.confirm('¿Eliminar esta calificación?'))
                        void runMutation(
                          gradesService.remove(item.id),
                          grades.refresh,
                          setMessage,
                          setBusy,
                        );
                    }}
                    disabled={busy}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span className="sr-only">Eliminar calificación</span>
                  </Button>
                )}
              </div>,
            ]);
  return (
    <>
      <p className="muted">GESTIÓN ACADÉMICA</p>
      <h1>{title}</h1>
      {createForm}
      {editForm}
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="toolbar">
          <p className="muted">Datos entregados por la API.</p>
        </div>
        <DataTable
          headers={
            is('users')
              ? ['Nombre', 'Email', 'Roles', 'Estado', 'Acciones']
              : is('subjects')
                ? ['Código', 'Nombre', 'Créditos', 'Docente', 'Estado', 'Acciones']
                : is('periods')
                  ? ['Nombre', 'Inicio', 'Finalización', 'Acciones']
                  : is('enrollments')
                    ? ['ID', 'Materia', 'Periodo', 'Estudiante', 'Estado', 'Acciones']
                    : ['ID', 'Inscripción', 'Evaluación', 'Puntaje', 'Acciones']
          }
          rows={rows}
        />
      </section>
    </>
  );
}

async function runMutation<T>(
  operation: Promise<T>,
  refresh: () => void,
  setMessage: (message: string) => void,
  setBusy: (busy: boolean) => void,
): Promise<boolean> {
  setBusy(true);
  try {
    await operation;
    refresh();
    setMessage('Operación completada correctamente.');
    return true;
  } catch (error) {
    setMessage(getErrorMessage(error));
    return false;
  } finally {
    setBusy(false);
  }
}
function Summary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<number | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (user) {
      void gradesService
        .summary(user.id)
        .then((result) => setSummary(result.weighted_average))
        .catch((reason: unknown) => setError(getErrorMessage(reason)))
        .finally(() => setPending(false));
    }
  }, [user]);
  if (!user) return null;
  return (
    <>
      <p className="muted">RESULTADO ACADÉMICO</p>
      <h1>Promedio ponderado</h1>
      <section className="panel">
        <p>Calculado por el backend utilizando los créditos de las materias.</p>
        {error ? (
          <ErrorMessage message={error} />
        ) : (
          <strong style={{ fontSize: '3rem' }}>
            {pending ? '...' : summary === null ? 'Sin calificaciones' : summary.toFixed(2)}
          </strong>
        )}
      </section>
    </>
  );
}
