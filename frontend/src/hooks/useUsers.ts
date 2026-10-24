import { useEffect, useState } from 'react';
import type { User } from '../api/types';
import { usersService } from '../services/users.service';
export function useUsers() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    setLoading(true);
    usersService
      .list()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);
  return { data, loading, error, refresh };
}
