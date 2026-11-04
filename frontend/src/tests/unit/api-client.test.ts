import axios, { type AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';

describe('API client security behavior', () => {
  const originalAdapter = api.defaults.adapter;

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('adds the CSRF cookie to state-changing requests and skips login', async () => {
    document.cookie = 'csrf_token=csrf-value';
    const requests: string[] = [];
    api.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      requests.push(`${config.method}:${config.url}:${config.headers.get('X-CSRF-Token') ?? ''}`);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    });

    await api.post('/users/');
    await api.post('/auth/login');
    await api.get('/users/');
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    await api.post('/users/');

    expect(requests).toEqual([
      'post:/users/:csrf-value',
      'post:/auth/login:',
      'get:/users/:',
      'post:/users/:',
    ]);
  });

  it('notifies the session context after protected API responses expire', async () => {
    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    api.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      const error = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config);
      Object.assign(error, { response: { status: 401, config } });
      throw error;
    });

    await expect(api.get('/subjects/')).rejects.toMatchObject({ response: { status: 401 } });
    expect(expired).toHaveBeenCalledOnce();
    await expect(api.get('/auth/me')).rejects.toMatchObject({ response: { status: 401 } });
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('auth:expired', expired);
  });
});
