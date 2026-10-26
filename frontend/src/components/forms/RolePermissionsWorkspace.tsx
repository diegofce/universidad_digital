import { useEffect, useState } from 'react';
import type { Permission, Role } from '../../api/types';
import { usersService } from '../../services/users.service';
import { getErrorMessage } from '../../utils/errors';
import { Button } from '../ui/Button';
import { Field } from './Field';

export function RolePermissionsWorkspace() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [permissionName, setPermissionName] = useState('');
  const [permissionDescription, setPermissionDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([usersService.roles(), usersService.permissions()])
      .then(([loadedRoles, loadedPermissions]) => {
        setRoles(loadedRoles);
        setPermissions(loadedPermissions);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const resetRole = () => {
    setSelectedRole(null);
    setRoleName('');
    setRoleDescription('');
  };

  const saveRole = async () => {
    setBusy(true);
    setError('');
    try {
      if (selectedRole) {
        await usersService.updateRole(selectedRole.id, {
          name: roleName,
          description: roleDescription,
        });
        setMessage('Rol actualizado correctamente.');
      } else {
        await usersService.createRole({ name: roleName, description: roleDescription });
        setMessage('Rol creado correctamente.');
      }
      resetRole();
      load();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const savePermission = async () => {
    setBusy(true);
    setError('');
    try {
      await usersService.createPermission({
        name: permissionName,
        description: permissionDescription,
      });
      setPermissionName('');
      setPermissionDescription('');
      setMessage('Permiso creado correctamente.');
      load();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const saveAssociations = async () => {
    if (!selectedRole) return;
    setBusy(true);
    setError('');
    try {
      await usersService.setRolePermissions(selectedRole.id, selectedPermissions);
      setMessage('Permisos del rol actualizados correctamente.');
      load();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <section className="panel">
        <p role="status">Cargando roles y permisos...</p>
      </section>
    );

  return (
    <>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-columns">
        <section className="panel">
          <h2>{selectedRole ? 'Editar rol' : 'Crear rol'}</h2>
          <Field
            label="Nombre técnico"
            required
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
          />
          <Field
            label="Descripción"
            required
            value={roleDescription}
            onChange={(event) => setRoleDescription(event.target.value)}
          />
          <div className="form-actions">
            <Button
              onClick={() => void saveRole()}
              disabled={busy || !roleName.trim() || !roleDescription.trim()}
            >
              Guardar
            </Button>
            {selectedRole && (
              <Button className="secondary" onClick={resetRole} disabled={busy}>
                Cancelar
              </Button>
            )}
          </div>
        </section>
        <section className="panel">
          <h2>Crear permiso</h2>
          <Field
            label="Nombre técnico"
            required
            value={permissionName}
            onChange={(event) => setPermissionName(event.target.value)}
          />
          <Field
            label="Descripción"
            required
            value={permissionDescription}
            onChange={(event) => setPermissionDescription(event.target.value)}
          />
          <Button
            onClick={() => void savePermission()}
            disabled={busy || !permissionName.trim() || !permissionDescription.trim()}
          >
            Guardar permiso
          </Button>
        </section>
      </div>
      <section className="panel">
        <h2>Roles</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.description}</td>
                  <td>{role.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td>
                    <Button
                      className="secondary"
                      onClick={() => {
                        setSelectedRole(role);
                        setRoleName(role.name);
                        setRoleDescription(role.description);
                        setSelectedPermissions(role.permissions ?? []);
                      }}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Permisos de {selectedRole?.name ?? 'selecciona un rol'}</h2>
        {selectedRole ? (
          permissions.map((permission) => (
            <label className="check-row" key={permission.id}>
              <input
                type="checkbox"
                checked={selectedPermissions.includes(permission.name)}
                onChange={(event) =>
                  setSelectedPermissions(
                    event.target.checked
                      ? [...selectedPermissions, permission.name]
                      : selectedPermissions.filter((name) => name !== permission.name),
                  )
                }
              />{' '}
              {permission.name} <span className="muted">{permission.description}</span>
            </label>
          ))
        ) : (
          <p className="muted">Selecciona un rol para asociar permisos.</p>
        )}
        {selectedRole && (
          <Button onClick={() => void saveAssociations()} disabled={busy}>
            Guardar asociaciones
          </Button>
        )}
      </section>
    </>
  );
}
