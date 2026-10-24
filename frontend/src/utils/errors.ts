import axios from 'axios';

export function getErrorMessage(
  error: unknown,
  fallback = 'No se pudo completar la operación.',
): string {
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') {
    const messages: Record<string, string> = {
      'Authentication required': 'Tu sesión no está autenticada.',
      'Invalid authentication': 'Tu sesión ha expirado. Inicia sesión nuevamente.',
      'CSRF validation failed':
        'La sesión de seguridad no es válida. Recarga e inténtalo de nuevo.',
      'Insufficient permissions': 'No tienes permisos para realizar esta operación.',
    };
    return messages[detail] ?? detail;
  }
  if (error.response?.status === 409)
    return 'La operación entra en conflicto con datos existentes.';
  if (error.response?.status === 422) return 'Revisa los datos introducidos.';
  if (!error.response) return 'No se pudo conectar con el backend.';
  return fallback;
}
