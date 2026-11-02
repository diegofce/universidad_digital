import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { DashboardPage } from '../../pages/DashboardPage';

const state = vi.hoisted(() => ({
  user: { id: 1, full_name: 'Ada Student', first_name: undefined as string | undefined, roles: ['student'] },
  logout: vi.fn(),
  subjects: { data: [{ id: 1 }], loading: false, error: null as unknown },
  enrollments: { data: [{ id: 2 }, { id: 3 }], loading: false, error: null as unknown },
  grades: { data: [{ id: 4 }], loading: false, error: null as unknown },
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, logout: state.logout }) }));
vi.mock('../../hooks/useSubjects', () => ({ useSubjects: () => state.subjects }));
vi.mock('../../hooks/useEnrollments', () => ({ useEnrollments: () => state.enrollments }));
vi.mock('../../hooks/useGrades', () => ({ useGrades: () => state.grades }));

describe('dashboard', () => {
  beforeEach(() => {
    state.user = { id: 1, full_name: 'Ada Student', first_name: 'Ada', roles: ['student'] };
    state.subjects = { data: [{ id: 1 }], loading: false, error: null };
    state.enrollments = { data: [{ id: 2 }, { id: 3 }], loading: false, error: null };
    state.grades = { data: [{ id: 4 }], loading: false, error: null };
    vi.clearAllMocks();
  });

  it('shows counts from loaded academic collections and administrator-only metric', () => {
    const { rerender } = render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: 'Hola, Ada Student' })).toBeVisible();
    expect(screen.getByText('Materias visibles').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Inscripciones').parentElement).toHaveTextContent('2');
    expect(screen.queryByText('Usuario activo')).not.toBeInTheDocument();
    state.user = { ...state.user, roles: ['administrator'] };
    rerender(<DashboardPage />);
    expect(screen.getByText('Usuario activo').parentElement).toHaveTextContent('1');
  });

  it('communicates loading and failed collection states', () => {
    state.subjects.loading = true;
    state.grades.error = new Error('unavailable');
    render(<DashboardPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando indicadores...');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar todos los indicadores.');
    expect(screen.getAllByText('...')).toHaveLength(3);
  });

  it('shows role-appropriate navigation and logs out to the login page', async () => {
    const user = userEvent.setup();
    state.logout.mockResolvedValue(undefined);
    state.user = { ...state.user, roles: ['administrator', 'student'] };
    const router = createMemoryRouter([
      { path: '/', element: <DashboardLayout />, children: [{ path: 'dashboard', element: <h1>Panel</h1> }] },
      { path: '/login', element: <h1>Inicio de sesión</h1> },
    ], { initialEntries: ['/dashboard'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toHaveTextContent('Usuarios');
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toHaveTextContent('Promedio');
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(state.logout).toHaveBeenCalledOnce();
    expect(await screen.findByRole('heading', { name: 'Inicio de sesión' })).toBeVisible();
  });

  it('shows teacher navigation and follows a selected section from the mobile menu', async () => {
    const user = userEvent.setup();
    state.user = { id: 2, full_name: 'Taylor Teacher', first_name: undefined, roles: ['teacher'] };
    const router = createMemoryRouter([
      { path: '/', element: <DashboardLayout />, children: [
        { path: 'teacher/subjects', element: <h1>Materias asignadas</h1> },
        { path: 'teacher/enrollments', element: <h1>Inscripciones docentes</h1> },
      ] },
    ], { initialEntries: ['/teacher/subjects'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText('Bienvenido: Taylor Teacher')).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toHaveTextContent('Mis materias');
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await user.click(screen.getByRole('link', { name: 'Inscripciones' }));
    expect(await screen.findByRole('heading', { name: 'Inscripciones docentes' })).toBeVisible();
  });
});
