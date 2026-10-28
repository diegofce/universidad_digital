import type { Period, Subject, UserLookup } from '../../api/types';

export const studentOption: UserLookup = {
  id: 7,
  display_name: 'Ada Student',
  email: 'ada@example.com',
  role: 'student',
};

export const subjectFixture: Subject = {
  id: 11,
  code: 'MAT-101',
  name: 'Matemáticas',
  description: null,
  credits: 3,
  is_active: true,
  teacher_id: null,
};

export const periodFixture: Period = {
  id: 13,
  name: '2026-1',
  starts_on: '2026-01-01',
  ends_on: '2026-06-30',
};
