import { useEffect, useState } from 'react';
import type { Grade } from '../api/types';
import { gradesService } from '../services/grades.service';
export function useGrades() {
  const [data, setData] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    setLoading(true);
    gradesService
      .list()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);
  return { data, loading, error, refresh };
}
