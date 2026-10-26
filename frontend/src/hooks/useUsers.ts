import { useEffect, useState } from 'react';
import type { User } from '../api/types';
import { usersService } from '../services/users.service';
export function useUsers(enabled = true, fetchAll = false) {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (fetchAll ? usersService.listAll() : usersService.list())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [enabled, fetchAll]);
  return { data, loading, error, refresh };
}
