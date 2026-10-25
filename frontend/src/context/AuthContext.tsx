import axios from 'axios';
import { useEffect, useState, type ReactNode } from 'react';
import type { User } from '../api/types';
import { hasPermission, hasRole } from '../auth/auth.utils';
import { authService } from '../services/auth.service';
import { AuthContext } from './auth-context';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  useEffect(() => {
    let active = true;
    const expire = () => setUser(null);
    window.addEventListener('auth:expired', expire);
    authService
      .me()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch((error: unknown) => {
        if (active) {
          setConnectionError(!axios.isAxiosError(error) || !error.response);
          if (axios.isAxiosError(error) && error.response?.status === 401) setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener('auth:expired', expire);
    };
  }, []);
  const login = async (email: string, password: string) => {
    const value = await authService.login(email, password);
    setConnectionError(false);
    setUser(value);
  };
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        connectionError,
        login,
        logout,
        hasRole: (role) => hasRole(user, role),
        hasPermission: (permission) => hasPermission(user, permission),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
