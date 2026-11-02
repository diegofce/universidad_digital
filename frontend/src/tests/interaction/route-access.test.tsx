import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../../auth/ProtectedRoute';
import { PermissionGuard } from '../../auth/PermissionGuard';

const auth = vi.hoisted(() => ({
  value: { user: null as object | null, isLoading: false, connectionError: false,
    hasRole: vi.fn<(role: string) => boolean>(), hasPermission: vi.fn<(permission: string) => boolean>() },
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth.value }));

function protectedTree() {
  return <MemoryRouter initialEntries={['/private']}><Routes>
    <Route path="/login" element={<h1>Inicio de sesión</h1>} />
    <Route path="/403" element={<h1>Acceso denegado</h1>} />
    <Route element={<ProtectedRoute />}><Route element={<PermissionGuard permission="grades.manage" role="teacher" />}>
      <Route path="/private" element={<h1>Calificaciones</h1>} />
    </Route></Route>
  </Routes></MemoryRouter>;
}

describe('route access', () => {
  it('shows progress while the session is being checked', () => {
    auth.value = { ...auth.value, user: null, isLoading: true, connectionError: false };
    render(protectedTree());
    expect(screen.getByText('Validando sesión...')).toBeVisible();
  });

  it('redirects an anonymous user to login and reports backend connection errors', () => {
    auth.value = { ...auth.value, user: null, isLoading: false, connectionError: false };
    const view = render(protectedTree());
    expect(screen.getByRole('heading', { name: 'Inicio de sesión' })).toBeVisible();
    view.unmount();
    auth.value = { ...auth.value, connectionError: true };
    render(protectedTree());
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el backend.');
  });

  it('allows an authorized teacher to reach a protected page', () => {
    auth.value = { ...auth.value, user: { id: 1 }, isLoading: false, connectionError: false };
    auth.value.hasRole.mockReturnValue(true);
    auth.value.hasPermission.mockReturnValue(true);
    render(protectedTree());
    expect(screen.getByRole('heading', { name: 'Calificaciones' })).toBeVisible();
  });

  it('denies access when either the required role or permission is missing', () => {
    auth.value = { ...auth.value, user: { id: 1 }, isLoading: false, connectionError: false };
    auth.value.hasRole.mockReturnValue(false);
    auth.value.hasPermission.mockReturnValue(true);
    const view = render(protectedTree());
    expect(screen.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible();
    view.unmount();
    auth.value.hasRole.mockReturnValue(true);
    auth.value.hasPermission.mockReturnValue(false);
    render(protectedTree());
    expect(screen.getByRole('heading', { name: 'Acceso denegado' })).toBeVisible();
  });
});
