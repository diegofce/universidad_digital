import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export function ProtectedRoute() {
  const { user, isLoading, connectionError } = useAuth();
  const location = useLocation();
  if (isLoading)
    return (
      <main className="center-state">
        <p aria-live="polite">Validando sesión...</p>
      </main>
    );
  if (!user && !connectionError)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user)
    return (
      <main className="center-state">
        <p role="alert">No se pudo conectar con el backend.</p>
      </main>
    );
  return <Outlet />;
}
