import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usersService } from '../../services/users.service';
import { RolePermissionsWorkspace } from '../../components/forms/RolePermissionsWorkspace';

vi.mock('../../services/users.service', () => ({
  usersService: { roles: vi.fn(), permissions: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), createPermission: vi.fn(), setRolePermissions: vi.fn() },
}));
const roles = [{ id: 3, name: 'teacher', description: 'Docente', is_active: true, permissions: ['grades.manage'] }];
const permissions = [
  { id: 1, name: 'grades.manage', description: 'Gestionar calificaciones', is_active: true },
  { id: 2, name: 'legacy.access', description: 'Permiso legado', is_active: false },
];

describe('role and permission management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersService.roles).mockResolvedValue(roles);
    vi.mocked(usersService.permissions).mockResolvedValue(permissions);
    vi.mocked(usersService.createRole).mockResolvedValue(roles[0]);
    vi.mocked(usersService.updateRole).mockResolvedValue(roles[0]);
    vi.mocked(usersService.createPermission).mockResolvedValue(permissions[0]);
    vi.mocked(usersService.setRolePermissions).mockResolvedValue(roles[0]);
  });

  it('loads roles, edits a role, and saves its selected permissions', async () => {
    const user = userEvent.setup();
    render(<RolePermissionsWorkspace />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando roles y permisos...');
    await screen.findByRole('heading', { name: 'Crear rol' });
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar rol' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /grades.manage/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /legacy.access/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Guardar asociaciones' }));
    await waitFor(() => expect(usersService.setRolePermissions).toHaveBeenCalledWith(3, ['grades.manage']));
    expect(await screen.findByRole('status')).toHaveTextContent('Permisos del rol actualizados correctamente.');
  });

  it('creates a role and a permission from validated fields', async () => {
    const user = userEvent.setup();
    render(<RolePermissionsWorkspace />);
    await screen.findByRole('heading', { name: 'Crear rol' });
    const [roleName, roleDescription, permissionName, permissionDescription] = screen.getAllByRole('textbox');
    await user.type(roleName, 'advisor');
    await user.type(roleDescription, 'Asesor académico');
    await user.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    await waitFor(() => expect(usersService.createRole).toHaveBeenCalledWith({ name: 'advisor', description: 'Asesor académico' }));
    await user.type(permissionName, 'periods.view');
    await user.type(permissionDescription, 'Consultar periodos');
    await user.click(screen.getByRole('button', { name: 'Guardar permiso' }));
    await waitFor(() => expect(usersService.createPermission).toHaveBeenCalledWith({ name: 'periods.view', description: 'Consultar periodos' }));
  });

  it('shows a useful error when initial role data cannot be loaded', async () => {
    vi.mocked(usersService.roles).mockRejectedValue(Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { detail: 'No autorizado' } },
    }));
    render(<RolePermissionsWorkspace />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado');
  });

  it('reports mutation errors for role edits, permission creation, and associations', async () => {
    const user = userEvent.setup();
    const denied = () => {
      const error = new axios.AxiosError('forbidden', 'ERR_BAD_REQUEST');
      Object.assign(error, { response: { status: 403, data: { detail: 'Insufficient permissions' } } });
      return error;
    };
    vi.mocked(usersService.updateRole).mockRejectedValueOnce(denied());
    vi.mocked(usersService.createPermission).mockRejectedValue(denied());
    vi.mocked(usersService.setRolePermissions).mockRejectedValue(denied());
    render(<RolePermissionsWorkspace />);
    await screen.findByRole('heading', { name: 'Crear rol' });

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getAllByRole('textbox')[1]);
    await user.type(screen.getAllByRole('textbox')[1], 'Docente actualizado');
    await user.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para realizar esta operación.');

    await user.type(screen.getAllByRole('textbox')[2], 'periods.manage');
    await user.type(screen.getAllByRole('textbox')[3], 'Administrar periodos');
    await user.click(screen.getByRole('button', { name: 'Guardar permiso' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para realizar esta operación.');

    await user.click(screen.getByRole('button', { name: 'Guardar asociaciones' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para realizar esta operación.');
  });
});
