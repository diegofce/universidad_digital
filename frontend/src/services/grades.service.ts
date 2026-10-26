import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Grade, GradeCreate, GradeSummary, GradeUpdate } from '../api/types';
export const gradesService = {
  list: () => api.get<Grade[]>(endpoints.grades).then((r) => r.data),
  get: (id: number) => api.get<Grade>(`${endpoints.grades}${id}`).then((r) => r.data),
  create: (data: GradeCreate) => api.post<Grade>(endpoints.grades, data).then((r) => r.data),
  update: (id: number, data: GradeUpdate) =>
    api.put<Grade>(`${endpoints.grades}${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`${endpoints.grades}${id}`),
  summary: (studentId: number, periodId?: number) =>
    api
      .get<GradeSummary>(`${endpoints.grades}summary/${studentId}`, {
        params: periodId ? { period_id: periodId } : undefined,
      })
      .then((r) => ({
        ...r.data,
        weighted_average: r.data.weighted_average === null ? null : Number(r.data.weighted_average),
      })),
};
