import { useEffect, useState } from 'react';
import type { Period } from '../api/types';
import { periodsService } from '../services/periods.service';

export function usePeriods() {
  const [data, setData] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    setLoading(true);
    setError(null);
    periodsService
      .list()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);
  return { data, loading, error, refresh };
}
