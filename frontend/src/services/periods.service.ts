import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Period, PeriodCreate, PeriodUpdate } from '../api/types';
export const periodsService = {
  list: () => api.get<Period[]>(endpoints.periods).then((r) => r.data),
  create: (data: PeriodCreate) => api.post<Period>(endpoints.periods, data).then((r) => r.data),
  update: (id: number, data: PeriodUpdate) =>
    api.put<Period>(`${endpoints.periods}${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`${endpoints.periods}${id}`),
};
