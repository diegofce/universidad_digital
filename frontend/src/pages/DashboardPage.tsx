import { BookOpen, ClipboardList, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useEnrollments } from '../hooks/useEnrollments';
import { useGrades } from '../hooks/useGrades';
import { useSubjects } from '../hooks/useSubjects';
export function DashboardPage() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const enrollments = useEnrollments();
  const grades = useGrades();
  const collectionLoading = subjects.loading || enrollments.loading || grades.loading;
  const collectionError = subjects.error || enrollments.error || grades.error;
  const cards = [
    { label: 'Materias visibles', value: subjects.data.length, icon: BookOpen },
    { label: 'Inscripciones', value: enrollments.data.length, icon: ClipboardList },
    { label: 'Calificaciones', value: grades.data.length, icon: GraduationCap },
    ...(user?.roles.includes('administrator')
      ? [{ label: 'Usuario activo', value: 1, icon: Users }]
      : []),
  ];
  return (
    <>
      <p className="muted">PANEL DE CONTROL</p>
      <h1>Hola, {user?.full_name}</h1>
      <p className="muted">Información disponible según tu sesión y permisos reales.</p>
      {collectionLoading && (
        <p className="alert" role="status">
          Cargando indicadores...
        </p>
      )}
      {collectionError && (
        <p className="alert" role="alert">
          No se pudieron cargar todos los indicadores.
        </p>
      )}
      <div className="grid">
        {cards.map(({ label, value, icon: Icon }) => (
          <article className="panel stat" key={label}>
            <Icon aria-hidden="true" />
            <span className="muted">{label}</span>
            <strong>{collectionLoading ? '...' : collectionError ? 'No disponible' : value}</strong>
          </article>
        ))}
      </div>
    </>
  );
}
