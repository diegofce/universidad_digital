import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserCreateForm } from '../../components/forms/CrudForms';

describe('UserCreateForm', () => {
  it('renders labeled fields and an accessible submit button', () => {
    render(<UserCreateForm onSubmit={vi.fn()} busy={false} />);

    expect(screen.getByRole('heading', { name: 'Crear usuario' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeVisible();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('does not submit an empty required form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<UserCreateForm onSubmit={onSubmit} busy={false} />);

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInvalid();
  });

  it('submits entered data and preserves the form contract', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<UserCreateForm onSubmit={onSubmit} busy={false} />);

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Nombre completo' }), 'Ada Student');
    await user.type(screen.getByRole('textbox', { name: 'Nombres' }), 'Ada');
    await user.type(screen.getByRole('textbox', { name: 'Apellidos' }), 'Student');
    await user.type(screen.getByRole('textbox', { name: 'Cédula' }), 'STUDENT-001');
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '2000-01-15');
    await user.type(screen.getByLabelText('Teléfono'), '+573001112233');
    await user.type(screen.getByLabelText('Contraseña'), 'correct-password-123');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'ada@example.com',
      full_name: 'Ada Student',
      password: 'correct-password-123',
      roles: ['student'],
      first_name: 'Ada',
      last_name: 'Student',
      identification_number: 'STUDENT-001',
      birth_date: '2000-01-15',
      phone: '+573001112233',
    });
  });

  it('disables submission while the async action is busy', () => {
    render(<UserCreateForm onSubmit={vi.fn()} busy />);

    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
  });
});
