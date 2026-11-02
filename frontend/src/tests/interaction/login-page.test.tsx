import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../../pages/auth/LoginPage';

const login = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ login }) }));
function CurrentPath() { return <p>Ruta actual: {useLocation().pathname}</p>; }
function app(from?: string) {
  return <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="*" element={<CurrentPath />} />
  </Routes></MemoryRouter>;
}

describe('login page', () => {
  it('validates credentials and returns to the requested page after login', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(undefined);
    render(app('/admin/grades'));
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Introduce un email válido')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'teacher@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Ruta actual: /admin/grades')).toBeVisible();
    expect(login).toHaveBeenCalledWith('teacher@example.com', 'secret');
  });

  it('shows an API authentication failure to the user', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error('bad credentials'));
    render(app());
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'wrong@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  });
});
