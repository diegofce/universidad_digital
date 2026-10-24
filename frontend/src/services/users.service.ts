import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Permission, Role, User, UserCreate, UserUpdate } from '../api/types';
export const usersService = {
  list: (offset = 0, limit = 100) =>
    api.get<User[]>(endpoints.users, { params: { offset, limit } }).then((r) => r.data),
  get: (id: number) => api.get<User>(`${endpoints.users}${id}`).then((r) => r.data),
  create: (data: UserCreate) => api.post<User>(endpoints.users, data).then((r) => r.data),
  update: (id: number, data: UserUpdate) =>
    api.put<User>(`${endpoints.users}${id}`, data).then((r) => r.data),
  deactivate: (id: number) => api.delete(`${endpoints.users}${id}`),
  roles: () => api.get<Role[]>(endpoints.roles).then((r) => r.data),
  createRole: (data: Omit<Role, 'id' | 'is_active'>) =>
    api.post<Role>(endpoints.roles, data).then((r) => r.data),
  updateRole: (id: number, data: Partial<Role>) =>
    api.put<Role>(`${endpoints.roles}/${id}`, data).then((r) => r.data),
  setRolePermissions: (id: number, permissions: string[]) =>
    api.put<Role>(`${endpoints.roles}/${id}/permissions`, { permissions }).then((r) => r.data),
  permissions: () => api.get<Permission[]>(endpoints.permissions).then((r) => r.data),
  createPermission: (data: Omit<Permission, 'id' | 'is_active'>) =>
    api.post<Permission>(endpoints.permissions, data).then((r) => r.data),
  updatePermission: (id: number, data: Partial<Permission>) =>
    api.put<Permission>(`${endpoints.permissions}/${id}`, data).then((r) => r.data),
};
