import { GraduationCap, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/dashboard', label: 'Resumen' },
    ...(user?.roles.includes('administrator')
      ? [
          { to: '/admin/users', label: 'Usuarios' },
          { to: '/admin/roles', label: 'Roles y permisos' },
          { to: '/admin/subjects', label: 'Materias' },
          { to: '/admin/periods', label: 'Periodos' },
          { to: '/admin/enrollments', label: 'Inscripciones' },
          { to: '/admin/grades', label: 'Calificaciones' },
          { to: '/admin/audit', label: 'Auditoría' },
        ]
      : []),
    ...(user?.roles.includes('teacher')
      ? [
          { to: '/teacher/subjects', label: 'Mis materias' },
          { to: '/teacher/enrollments', label: 'Inscripciones' },
          { to: '/teacher/grades', label: 'Calificaciones' },
        ]
      : []),
    ...(user?.roles.includes('student')
      ? [
          { to: '/student/subjects', label: 'Materias' },
          { to: '/student/enrollments', label: 'Mis inscripciones' },
          { to: '/student/grades', label: 'Mis calificaciones' },
          { to: '/student/summary', label: 'Promedio' },
        ]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <GraduationCap size={20} />
          </span>{' '}
          Universidad Digital
        </div>
        <nav className="nav" aria-label="Navegación principal">
          {links.map((link) => (
            <NavLink
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'active' : '')}
              to={link.to}
              key={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setOpen(!open)}>
            <Menu />
          </button>
          <span>
            <strong>Bienvenido: {user?.first_name ?? user?.full_name}</strong>
            <span className="muted"> · Cargo: {user?.roles.join(', ')}</span>
          </span>
          <button
            className="button secondary"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={16} aria-hidden="true" /> Salir
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
