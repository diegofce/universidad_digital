import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export function PermissionGuard({ permission, role }: { permission?: string; role?: string }) {
  const { hasPermission, hasRole } = useAuth();
  if (role && !hasRole(role)) return <Navigate to="/403" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
