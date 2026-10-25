import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { User } from '../api/types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<User>(endpoints.auth.login, { email, password }).then((r) => r.data),
  me: () => api.get<User>(endpoints.auth.me).then((r) => r.data),
  logout: () => api.post<void>(endpoints.auth.logout),
};
