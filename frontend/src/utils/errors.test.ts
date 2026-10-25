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
});
