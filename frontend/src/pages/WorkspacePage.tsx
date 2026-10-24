import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorMessage, Loading } from '../components/feedback/State';
import { DataTable } from '../components/tables/DataTable';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useEnrollments } from '../hooks/useEnrollments';
import { useGrades } from '../hooks/useGrades';
import { useSubjects } from '../hooks/useSubjects';
import { useUsers } from '../hooks/useUsers';
import { gradesService } from '../services/grades.service';
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
  const users = useUsers();
  const subjects = useSubjects();
  const enrollments = useEnrollments();
  const grades = useGrades();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const is = (value: string) => path.endsWith(value);
  const data = is('users')
    ? users
    : is('subjects')
      ? subjects
      : is('enrollments')
        ? enrollments
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
  const rows = is('users')
    ? users.data.map((item) => [
        item.full_name,
        item.email,
        item.roles.join(', '),
        item.is_active ? <span className="badge">Activo</span> : 'Inactivo',
        <Button
          className="danger"
          onClick={() => {
            if (window.confirm('¿Desactivar este usuario?')) {
              setBusy(true);
              void import('../services/users.service')
                .then(({ usersService }) => usersService.deactivate(item.id))
                .then(() => users.refresh())
                .catch((error: unknown) => setMessage(getErrorMessage(error)))
                .finally(() => setBusy(false));
            }
          }}
          disabled={busy}
        >
          Desactivar
        </Button>,
      ])
    : is('subjects')
      ? subjects.data.map((item) => [
          item.code,
          item.name,
          String(item.credits),
          item.teacher_id ? String(item.teacher_id) : 'Sin asignar',
          item.is_active ? 'Activa' : 'Inactiva',
        ])
      : is('enrollments')
        ? enrollments.data.map((item) => [
            String(item.id),
            String(item.subject_id),
            String(item.period_id),
            String(item.student_id),
            item.status,
          ])
        : grades.data.map((item) => [
            String(item.id),
            String(item.enrollment_id),
            item.assessment,
            String(item.score),
          ]);
  return (
    <>
      <p className="muted">GESTIÓN ACADÉMICA</p>
      <h1>{title}</h1>
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
                ? ['Código', 'Nombre', 'Créditos', 'Docente', 'Estado']
                : is('enrollments')
                  ? ['ID', 'Materia', 'Periodo', 'Estudiante', 'Estado']
                  : ['ID', 'Inscripción', 'Evaluación', 'Puntaje']
          }
          rows={rows}
        />
      </section>
    </>
  );
}
function Summary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (user) {
      void gradesService
        .summary(user.id)
        .then((result) => setSummary(result.weighted_average))
        .catch((reason: unknown) => setError(getErrorMessage(reason)));
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
            {summary === null ? '...' : summary.toFixed(2)}
          </strong>
        )}
      </section>
    </>
  );
}
