export type RoleName = string;
export type EnrollmentStatus = 'active' | 'completed' | 'cancelled';

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: RoleName[];
}
export interface Role {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}
export interface Permission {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}
export interface Subject {
  id: number;
  code: string;
  name: string;
  description: string | null;
  credits: number;
  is_active: boolean;
  teacher_id: number | null;
}
export interface Period {
  id: number;
  name: string;
  starts_on: string;
  ends_on: string;
}
export interface Enrollment {
  id: number;
  student_id: number;
  subject_id: number;
  period_id: number;
  status: EnrollmentStatus;
  created_at: string;
}
export interface Grade {
  id: number;
  enrollment_id: number;
  score: number;
  assessment: string;
  created_at: string;
}
export interface GradeSummary {
  student_id: number;
  period_id: number | null;
  weighted_average: number | null;
}
export interface UserCreate {
  email: string;
  full_name: string;
  password: string;
  roles: string[];
}
export interface UserUpdate {
  email?: string;
  full_name?: string;
  password?: string;
  is_active?: boolean;
  roles?: string[];
}
export interface SubjectCreate {
  code: string;
  name: string;
  description?: string;
  credits: number;
  teacher_id?: number;
}
export interface SubjectUpdate extends Partial<SubjectCreate> {
  is_active?: boolean;
}
export interface PeriodCreate {
  name: string;
  starts_on: string;
  ends_on: string;
}
export interface PeriodUpdate {
  name?: string;
  starts_on?: string;
  ends_on?: string;
}
export interface EnrollmentCreate {
  student_id: number;
  subject_id: number;
  period_id: number;
}
export interface GradeCreate {
  enrollment_id: number;
  score: number;
  assessment: string;
}
export interface GradeUpdate {
  score?: number;
  assessment?: string;
}
