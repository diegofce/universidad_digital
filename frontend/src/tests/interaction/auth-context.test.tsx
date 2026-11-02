import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../../hooks/useAuth';
import { AuthProvider } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/auth.service', () => ({
  authService: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));

const account = {
  id: 1, email: 'admin@example.com', full_name: 'Admin User', is_active: true,
  created_at: '2026-01-01T00:00:00Z', roles: ['administrator'], permissions: ['users.manage'],
  first_name: 'Admin', last_name: 'User', identification_number: null, birth_date: null, phone: null,
};

function AuthStatus() {
  const auth = useAuth();
  return <section>
    <p>{auth.isLoading ? 'Cargando sesión' : auth.user?.email ?? 'Sesión cerrada'}</p>
    <p>{auth.connectionError ? 'Error de conexión' : 'Conexión disponible'}</p>
    <p>{auth.hasRole('administrator') ? 'Administrador' : 'Sin rol'}</p>
    <p>{auth.hasPermission('users.manage') ? 'Gestiona usuarios' : 'Sin permiso'}</p>
    <button onClick={() => void auth.login('admin@example.com', 'secure-password')}>Iniciar sesión</button>
    <button onClick={() => void auth.logout()}>Cerrar sesión</button>
  </section>;
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the current account and exposes role and permission checks', async () => {
    vi.mocked(authService.me).mockResolvedValue(account);
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    expect(screen.getByText('Cargando sesión')).toBeVisible();
    expect(await screen.findByText('admin@example.com')).toBeVisible();
    expect(screen.getByText('Administrador')).toBeVisible();
    expect(screen.getByText('Gestiona usuarios')).toBeVisible();
  });

  it('updates session after login and clears it after logout', async () => {
    vi.mocked(authService.me).mockRejectedValue(new Error('unauthorized'));
    vi.mocked(authService.login).mockResolvedValue(account);
    vi.mocked(authService.logout).mockResolvedValue({ data: undefined } as never);
    const user = userEvent.setup();
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    await screen.findByText('Sesión cerrada');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('admin@example.com')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByText('Sesión cerrada')).toBeVisible();
    expect(authService.logout).toHaveBeenCalledOnce();
  });

  it('reports an unavailable backend and handles auth expiration', async () => {
    vi.mocked(authService.me).mockRejectedValue(new Error('network unavailable'));
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    expect(await screen.findByText('Error de conexión')).toBeVisible();
    vi.mocked(authService.me).mockResolvedValue(account);
    const { unmount } = render(<AuthProvider><AuthStatus /></AuthProvider>);
    await waitFor(() => expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0));
    window.dispatchEvent(new Event('auth:expired'));
    expect(await screen.findByText('Sesión cerrada')).toBeVisible();
    unmount();
  });
});
