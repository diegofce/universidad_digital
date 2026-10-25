import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionGuard } from '../auth/PermissionGuard';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ErrorPage } from '../pages/errors/ErrorPages';
import { WorkspacePage } from '../pages/WorkspacePage';
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/403"
        element={
          <ErrorPage
            code="403"
            title="Acceso denegado"
            text="Tu sesión no tiene autorización para esta sección."
          />
        }
      />
      <Route
        path="/404"
        element={
          <ErrorPage code="404" title="Página no encontrada" text="La ruta solicitada no existe." />
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/student/*" element={<WorkspacePage />} />
          <Route path="/teacher/*" element={<WorkspacePage />} />
          <Route element={<PermissionGuard permission="users.manage" />}>
            <Route path="/admin/users" element={<WorkspacePage />} />
          </Route>
          <Route element={<PermissionGuard permission="subjects.manage" />}>
            <Route path="/admin/subjects" element={<WorkspacePage />} />
          </Route>
          <Route element={<PermissionGuard permission="enrollments.manage" />}>
            <Route path="/admin/periods" element={<WorkspacePage />} />
            <Route path="/admin/enrollments" element={<WorkspacePage />} />
          </Route>
          <Route element={<PermissionGuard permission="grades.manage" />}>
            <Route path="/admin/grades" element={<WorkspacePage />} />
          </Route>
          <Route element={<PermissionGuard permission="roles.manage" />}>
            <Route path="/admin/roles" element={<WorkspacePage />} />
          </Route>
          <Route path="/admin/audit" element={<WorkspacePage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
