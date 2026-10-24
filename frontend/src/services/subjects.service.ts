import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Subject, SubjectCreate, SubjectUpdate } from '../api/types';
export const subjectsService = {
  list: () => api.get<Subject[]>(endpoints.subjects).then((r) => r.data),
  get: (id: number) => api.get<Subject>(`${endpoints.subjects}${id}`).then((r) => r.data),
  create: (data: SubjectCreate) => api.post<Subject>(endpoints.subjects, data).then((r) => r.data),
  update: (id: number, data: SubjectUpdate) =>
    api.put<Subject>(`${endpoints.subjects}${id}`, data).then((r) => r.data),
  deactivate: (id: number) => api.delete(`${endpoints.subjects}${id}`),
};
