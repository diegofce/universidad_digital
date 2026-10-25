import type { User } from '../api/types';
export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  connectionError: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}
