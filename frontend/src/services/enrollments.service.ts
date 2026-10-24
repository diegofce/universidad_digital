import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Enrollment, EnrollmentCreate, EnrollmentStatus } from '../api/types';
export const enrollmentsService = {
  list: () => api.get<Enrollment[]>(endpoints.enrollments).then((r) => r.data),
  get: (id: number) => api.get<Enrollment>(`${endpoints.enrollments}${id}`).then((r) => r.data),
  create: (data: EnrollmentCreate) =>
    api.post<Enrollment>(endpoints.enrollments, data).then((r) => r.data),
  update: (id: number, status: EnrollmentStatus) =>
    api.put<Enrollment>(`${endpoints.enrollments}${id}`, { status }).then((r) => r.data),
  cancel: (id: number) => api.delete(`${endpoints.enrollments}${id}`),
};
