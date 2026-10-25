import { beforeEach, describe, expect, it } from 'vitest';
import { getCsrfToken } from './csrf';

describe('getCsrfToken', () => {
  beforeEach(() => {
    document.cookie = 'csrf_token=token%2Fvalue';
  });
  it('returns only the decoded cookie value', () => {
    expect(getCsrfToken()).toBe('token/value');
  });
  it('returns undefined when the cookie is absent', () => {
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    expect(getCsrfToken()).toBeUndefined();
  });
});
