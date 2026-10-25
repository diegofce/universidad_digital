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
      <div className="grid">
        {cards.map(({ label, value, icon: Icon }) => (
          <article className="panel stat" key={label}>
            <Icon aria-hidden="true" />
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </>
  );
}
