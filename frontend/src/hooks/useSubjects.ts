import { useEffect, useState } from 'react';
import type { Subject } from '../api/types';
import { subjectsService } from '../services/subjects.service';
export function useSubjects(enabled = true) {
  const [data, setData] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    subjectsService
      .list()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  };
  useEffect(refresh, [enabled]);
  return { data, loading, error, refresh };
}
