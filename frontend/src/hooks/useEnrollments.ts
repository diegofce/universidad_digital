import { useEffect, useState } from 'react';
import type { Enrollment } from '../api/types';
import { enrollmentsService } from '../services/enrollments.service';
export function useEnrollments(enabled = true) {
  const [data, setData] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    enrollmentsService
      .list()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [enabled]);
  return { data, loading, error, refresh };
}
