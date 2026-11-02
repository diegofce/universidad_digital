import axios from 'axios';
import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('maps known backend authorization errors', () => {
    const error = new axios.AxiosError('forbidden', 'ERR_BAD_REQUEST');
    Object.assign(error, {
      response: { status: 403, data: { detail: 'Insufficient permissions' } },
    });
    expect(getErrorMessage(error)).toContain('permisos');
  });
  it('handles connection failures without exposing internals', () => {
    expect(getErrorMessage(new Error('secret'))).toBe('No se pudo completar la operación.');
  });
  it('maps authentication and CSRF responses and handles validation and conflict statuses', () => {
    const responseError = (detail: string, status = 401) => {
      const error = new axios.AxiosError('request failed', 'ERR_BAD_REQUEST');
      Object.assign(error, { response: { status, data: { detail } } });
      return error;
    };
    expect(getErrorMessage(responseError('Authentication required'))).toContain('no está autenticada');
    expect(getErrorMessage(responseError('Invalid authentication'))).toContain('ha expirado');
    expect(getErrorMessage(responseError('CSRF validation failed'))).toContain('sesión de seguridad');
    const statusError = (status: number) => {
      const error = new axios.AxiosError('request failed', 'ERR_BAD_REQUEST');
      Object.assign(error, { response: { status, data: {} } });
      return error;
    };
    expect(getErrorMessage(statusError(409))).toContain('conflicto');
    expect(getErrorMessage(statusError(422))).toContain('Revisa los datos');
  });
  it('uses a connection message for network failures and fallback for unknown responses', () => {
    const networkError = new axios.AxiosError('network', 'ERR_NETWORK');
    expect(getErrorMessage(networkError)).toBe('No se pudo conectar con el backend.');
    const serverError = new axios.AxiosError('server error', 'ERR_BAD_RESPONSE');
    Object.assign(serverError, { response: { status: 500, data: {} } });
    expect(getErrorMessage(serverError, 'Intenta más tarde.')).toBe('Intenta más tarde.');
  });
});
