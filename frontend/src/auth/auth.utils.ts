import type { User } from '../api/types';
export function hasRole(user: User | null, role: string): boolean {
  return Boolean(user?.roles.includes(role));
}
export function hasPermission(user: User | null, permission: string): boolean {
  return Boolean(user?.permissions?.includes(permission));
}
