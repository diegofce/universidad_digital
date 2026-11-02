import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';

type RequestHandler = { fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig };
type ResponseHandler = { rejected: (error: unknown) => Promise<never> };
const requestHandler = (api.interceptors.request as unknown as { handlers: RequestHandler[] }).handlers[0];
const responseHandler = (api.interceptors.response as unknown as { handlers: ResponseHandler[] }).handlers[0];

function request(method: string, url: string) {
  return { method, url, headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
}

describe('API client security behavior', () => {
  afterEach(() => { document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT'; });

  it('adds the CSRF cookie to state-changing requests and skips login', () => {
    document.cookie = 'csrf_token=csrf-value';
    const update = requestHandler.fulfilled(request('post', '/users/'));
    expect(update.headers.get('X-CSRF-Token')).toBe('csrf-value');
    const login = requestHandler.fulfilled(request('post', '/auth/login'));
    expect(login.headers.get('X-CSRF-Token')).toBeUndefined();
    const read = requestHandler.fulfilled(request('get', '/users/'));
    expect(read.headers.get('X-CSRF-Token')).toBeUndefined();
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const withoutCookie = requestHandler.fulfilled(request('post', '/users/'));
    expect(withoutCookie.headers.get('X-CSRF-Token')).toBeUndefined();
  });

  it('notifies the session context after protected API responses expire', async () => {
    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    const error = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST');
    Object.assign(error, { config: { url: '/api/v1/subjects/' }, response: { status: 401 } });
    await expect(responseHandler.rejected(error)).rejects.toBe(error);
    expect(expired).toHaveBeenCalledOnce();
    const currentSession = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST');
    Object.assign(currentSession, { config: { url: '/api/v1/auth/me' }, response: { status: 401 } });
    await expect(responseHandler.rejected(currentSession)).rejects.toBe(currentSession);
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('auth:expired', expired);
  });
});
