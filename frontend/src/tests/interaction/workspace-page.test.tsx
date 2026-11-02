import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { gradesService } from '../../services/grades.service';
import { periodsService } from '../../services/periods.service';
import { subjectsService } from '../../services/subjects.service';
import { usersService } from '../../services/users.service';
import { enrollmentsService } from '../../services/enrollments.service';
import type { Period, User } from '../../api/types';

const data = vi.hoisted(() => ({
  users: { data: [] as User[], loading: false, error: null as unknown, refresh: vi.fn() },
  subjects: { data: [{ id: 11, code: 'MAT-101', name: 'Matemáticas', description: null, credits: 3, is_active: true, teacher_id: null }], loading: false, error: null as unknown, refresh: vi.fn() },
  periods: { data: [] as Period[], loading: false, error: null, refresh: vi.fn() },
  enrollments: { data: [] as Array<{ id: number; student_id: number; subject_id: number; period_id: number; status: 'active' | 'completed' | 'cancelled'; created_at: string }>, loading: false, error: null, refresh: vi.fn() },
  grades: { data: [] as Array<{ id: number; enrollment_id: number; score: number; assessment: string; created_at: string }>, loading: false, error: null, refresh: vi.fn() },
  auth: { user: { id: 7 }, hasPermission: vi.fn(() => true), hasRole: vi.fn(() => true) },
}));
vi.mock('../../hooks/useUsers', () => ({ useUsers: () => data.users }));
vi.mock('../../hooks/useSubjects', () => ({ useSubjects: () => data.subjects }));
vi.mock('../../hooks/usePeriods', () => ({ usePeriods: () => data.periods }));
vi.mock('../../hooks/useEnrollments', () => ({ useEnrollments: () => data.enrollments }));
vi.mock('../../hooks/useGrades', () => ({ useGrades: () => data.grades }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => data.auth }));
vi.mock('../../services/subjects.service', () => ({ subjectsService: { create: vi.fn(), update: vi.fn(), deactivate: vi.fn() } }));
vi.mock('../../services/grades.service', () => ({ gradesService: { summary: vi.fn(), update: vi.fn(), create: vi.fn() } }));
vi.mock('../../services/periods.service', () => ({ periodsService: { create: vi.fn(), update: vi.fn() } }));
vi.mock('../../services/enrollments.service', () => ({ enrollmentsService: { create: vi.fn(), update: vi.fn(), cancel: vi.fn() } }));
vi.mock('../../services/users.service', () => ({ usersService: { lookup: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() } }));

const userFixture = (id: number): User => ({
  id, email: `student${id}@example.com`, full_name: `Student ${id}`, is_active: true,
  created_at: '2026-01-01T00:00:00Z', roles: ['student'], first_name: `Student${id}`, last_name: 'Example',
  identification_number: `ID-${id}`, birth_date: '2000-01-15', phone: '+573001112233',
});

function at(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <WorkspacePage /> }], { initialEntries: [path] });
  return { ...render(<RouterProvider router={router} />), router };
}

describe('academic workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.subjects.loading = false;
    data.subjects.error = null;
    data.subjects.data = [{ id: 11, code: 'MAT-101', name: 'Matemáticas', description: null, credits: 3, is_active: true, teacher_id: null }];
    data.users.data = [];
    data.periods.data = [];
    data.enrollments.data = [];
    data.grades.data = [];
    vi.mocked(usersService.lookup).mockResolvedValue([{ id: 21, display_name: 'Ada Teacher', email: 'ada@example.com', role: 'teacher' }]);
  });

  it('explains that audit data is unavailable from the current backend', () => {
    at('/admin/audit');
    expect(screen.getByRole('heading', { name: 'Auditoría no disponible' })).toBeVisible();
    expect(screen.getByText(/no expone un endpoint de auditoría/i)).toBeVisible();
  });

  it('shows the backend weighted average and an empty grade state', async () => {
    vi.mocked(gradesService.summary).mockResolvedValue({ student_id: 7, period_id: null, weighted_average: 4.256 });
    at('/student/summary');
    expect(await screen.findByText('4.26')).toBeVisible();
    expect(gradesService.summary).toHaveBeenCalledWith(7);
  });

  it('renders subject data, opens creation, and reports successful saves', async () => {
    const user = userEvent.setup();
    vi.mocked(subjectsService.create).mockResolvedValue({ id: 12, code: 'BIO-101', name: 'Biología', description: null, credits: 3, is_active: true, teacher_id: null });
    at('/admin/subjects');
    expect(screen.getByRole('cell', { name: 'MAT-101' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Crear materia' }));
    await user.type(screen.getByRole('textbox', { name: 'Código' }), 'BIO-101');
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Biología');
    await user.type(screen.getByRole('textbox', { name: 'Buscar docente' }), 'Ada');
    await waitFor(() => expect(usersService.lookup).toHaveBeenCalledWith('teacher', 'Ada'));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Docente' }), '21');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(subjectsService.create).toHaveBeenCalledWith({ code: 'BIO-101', name: 'Biología', credits: 3, teacher_id: 21 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Operación completada correctamente.');
  });

  it('shows loading and API error states for the selected section', () => {
    data.subjects.loading = true;
    const view = at('/admin/subjects');
    expect(screen.getByText('Cargando información...')).toBeVisible();
    view.unmount();
    data.subjects.loading = false;
    data.subjects.error = new Error('network failure');
    at('/admin/subjects');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar la operación.');
  });

  it('creates an academic period and refreshes the list after success', async () => {
    const user = userEvent.setup();
    vi.mocked(periodsService.create).mockResolvedValue({ id: 13, name: '2026-2', starts_on: '2026-07-01', ends_on: '2026-12-20' });
    at('/admin/periods');
    await user.click(screen.getByRole('button', { name: 'Crear periodo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), '2026-2');
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-07-01');
    await user.type(screen.getByLabelText('Fecha de finalización'), '2026-12-20');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(periodsService.create).toHaveBeenCalledWith({ name: '2026-2', starts_on: '2026-07-01', ends_on: '2026-12-20' }));
    expect(data.periods.refresh).toHaveBeenCalledOnce();
  });

  it('discards a draft when navigation is confirmed', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = at('/admin/subjects');
    await user.click(screen.getByRole('button', { name: 'Crear materia' }));
    expect(screen.getByRole('heading', { name: 'Crear materia' })).toBeVisible();
    await act(async () => { await view.router.navigate('/admin/periods'); });
    expect(await screen.findByRole('heading', { name: 'Periodos' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Crear materia' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('edits a grade and saves the updated score through the API service', async () => {
    const user = userEvent.setup();
    data.grades.data = [{ id: 41, enrollment_id: 31, score: 3, assessment: 'Parcial', created_at: '2026-01-01T00:00:00Z' }];
    vi.mocked(gradesService.update).mockResolvedValue(data.grades.data[0]);
    at('/admin/grades');
    await user.click(screen.getByRole('button', { name: 'Editar calificación' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }), '4.5');
    await user.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    await waitFor(() => expect(gradesService.update).toHaveBeenCalledWith(41, { score: 4.5, assessment: 'Parcial' }));
  });

  it('shows a no-grades result when the weighted average is missing', async () => {
    vi.mocked(gradesService.summary).mockResolvedValue({ student_id: 7, period_id: null, weighted_average: null });
    at('/student/summary');
    expect(await screen.findByText('Sin calificaciones')).toBeVisible();
  });

  it('updates and cancels an enrollment after user confirmation', async () => {
    const user = userEvent.setup();
    const enrollment = { id: 31, student_id: 7, subject_id: 11, period_id: 13, status: 'active' as const, created_at: '2026-01-01T00:00:00Z' };
    data.enrollments.data = [enrollment];
    vi.mocked(enrollmentsService.update).mockResolvedValue({ ...enrollment, status: 'completed' });
    vi.mocked(enrollmentsService.cancel).mockResolvedValue({ data: undefined } as never);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = at('/admin/enrollments');
    await user.click(screen.getByRole('button', { name: 'Editar inscripción' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'completed');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enrollmentsService.update).toHaveBeenCalledWith(31, 'completed'));
    view.unmount();

    data.enrollments.data = [enrollment];
    at('/admin/enrollments');
    await user.click(screen.getByRole('button', { name: 'Cancelar inscripción' }));
    await waitFor(() => expect(enrollmentsService.cancel).toHaveBeenCalledWith(31));
    expect(confirm).toHaveBeenCalledWith('¿Cancelar esta inscripción?');
    confirm.mockRestore();
  });

  it('paginates user records and saves edits', async () => {
    const user = userEvent.setup();
    data.users.data = Array.from({ length: 6 }, (_, index) => userFixture(index + 1));
    vi.mocked(usersService.update).mockResolvedValue(userFixture(1));
    at('/admin/users');
    expect(screen.getByText('Página 1 de 2')).toBeVisible();
    expect(screen.queryByText('Student 6')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Página 2 de 2')).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Student 6' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await user.click(screen.getAllByRole('button', { name: 'Editar usuario' })[0]);
    await user.clear(screen.getByRole('textbox', { name: 'Nombre completo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre completo' }), 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(usersService.update).toHaveBeenCalledWith(1, expect.objectContaining({ full_name: 'Ada Lovelace' })));
    expect(data.users.refresh).toHaveBeenCalledOnce();
  });

  it('creates a user and deactivates an active user only after confirmation', async () => {
    const user = userEvent.setup();
    data.users.data = [userFixture(1)];
    vi.mocked(usersService.create).mockResolvedValue(userFixture(2));
    vi.mocked(usersService.deactivate).mockResolvedValue({ data: undefined } as never);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = at('/admin/users');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com');
    await user.type(screen.getByRole('textbox', { name: 'Nombre completo' }), 'Ada Lovelace');
    await user.type(screen.getByRole('textbox', { name: 'Nombres' }), 'Ada');
    await user.type(screen.getByRole('textbox', { name: 'Apellidos' }), 'Lovelace');
    await user.type(screen.getByRole('textbox', { name: 'Cédula' }), 'ID-ADA');
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '2000-01-15');
    await user.type(screen.getByLabelText('Teléfono'), '+573001112233');
    await user.type(screen.getByLabelText('Contraseña'), 'long-password-123');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rol' }), 'teacher');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'ada@example.com', roles: ['teacher'] })));
    view.unmount();

    data.users.data = [userFixture(1)];
    at('/admin/users');
    await user.click(screen.getByRole('button', { name: 'Desactivar usuario' }));
    await waitFor(() => expect(usersService.deactivate).toHaveBeenCalledWith(1));
    expect(confirm).toHaveBeenCalledWith('¿Desactivar este usuario?');
    confirm.mockRestore();
  }, 15000);

  it('edits, deactivates, and reactivates a subject through its available actions', async () => {
    const user = userEvent.setup();
    const subject = { id: 11, code: 'MAT-101', name: 'Matemáticas', description: null, credits: 3, is_active: true, teacher_id: null };
    data.subjects.data = [subject];
    vi.mocked(subjectsService.update).mockRejectedValueOnce(new Error('write failed')).mockResolvedValue(subject);
    vi.mocked(subjectsService.deactivate).mockResolvedValue({ data: undefined } as never);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const view = at('/admin/subjects');
    await user.click(screen.getByRole('button', { name: 'Editar materia' }));
    await user.clear(screen.getByRole('textbox', { name: 'Nombre' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Álgebra');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No se pudo completar la operación.');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(subjectsService.update).toHaveBeenCalledWith(11, expect.objectContaining({ name: 'Álgebra' })));
    view.unmount();

    data.subjects.data = [subject];
    const deactivationView = at('/admin/subjects');
    await user.click(screen.getByRole('button', { name: 'Desactivar materia' }));
    await waitFor(() => expect(subjectsService.deactivate).toHaveBeenCalledWith(11));
    deactivationView.unmount();

    data.subjects.data = [{ ...subject, is_active: false }];
    const inactiveView = at('/admin/subjects');
    await user.click(screen.getByRole('button', { name: 'Reactivar materia' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'true');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(subjectsService.update).toHaveBeenLastCalledWith(11, expect.objectContaining({ is_active: true })));
    expect(confirm).toHaveBeenCalledWith('¿Desactivar esta materia?');
    inactiveView.unmount();
    confirm.mockRestore();
  });

  it('creates an enrollment after searching for a student and choosing an active subject and period', async () => {
    const user = userEvent.setup();
    data.subjects.data = [{ id: 11, code: 'MAT-101', name: 'Matemáticas', description: null, credits: 3, is_active: true, teacher_id: null }];
    data.periods.data = [{ id: 13, name: '2026-1', starts_on: '2026-01-01', ends_on: '2026-06-30' }];
    vi.mocked(usersService.lookup).mockResolvedValue([{ id: 7, display_name: 'Ada Student', email: 'ada@example.com', role: 'student' }]);
    vi.mocked(enrollmentsService.create).mockResolvedValue({ id: 31, student_id: 7, subject_id: 11, period_id: 13, status: 'active', created_at: '2026-01-01T00:00:00Z' });
    at('/admin/enrollments');
    await user.click(screen.getByRole('button', { name: 'Crear inscripción' }));
    const student = screen.getByRole('combobox', { name: 'Estudiante' });
    await user.type(student, 'Ada');
    await user.click(await screen.findByRole('option', { name: /Ada Student/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Materia' }), '11');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Periodo' }), '13');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(enrollmentsService.create).toHaveBeenCalledWith({ student_id: 7, subject_id: 11, period_id: 13 }));
  });

  it('creates a grade for a searched student and keeps grade management actions permission-gated', async () => {
    const user = userEvent.setup();
    data.enrollments.data = [{ id: 31, student_id: 7, subject_id: 11, period_id: 13, status: 'active', created_at: '2026-01-01T00:00:00Z' }];
    vi.mocked(usersService.lookup).mockResolvedValue([{ id: 7, display_name: 'Ada Student', email: 'ada@example.com', role: 'student' }]);
    vi.mocked(gradesService.create).mockResolvedValue({ id: 41, enrollment_id: 31, score: 4.5, assessment: 'Final', created_at: '2026-01-01T00:00:00Z' });
    const adminView = at('/admin/grades');
    await user.click(screen.getByRole('button', { name: 'Crear calificación' }));
    const student = screen.getByRole('combobox', { name: 'Estudiante' });
    await user.type(student, 'Ada');
    await user.click(await screen.findByRole('option', { name: /Ada Student/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Inscripción del estudiante' }), '31');
    await user.clear(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }), '4.5');
    await user.type(screen.getByRole('textbox', { name: 'Evaluación' }), 'Final');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(gradesService.create).toHaveBeenCalledWith({ enrollment_id: 31, score: 4.5, assessment: 'Final' }));
    adminView.unmount();

    data.grades.data = [{ id: 41, enrollment_id: 31, score: 4.5, assessment: 'Final', created_at: '2026-01-01T00:00:00Z' }];
    data.auth.hasPermission.mockReturnValue(false);
    const view = at('/teacher/grades');
    expect(screen.queryByRole('button', { name: 'Crear calificación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar calificación' })).not.toBeInTheDocument();
    view.unmount();
    data.auth.hasPermission.mockReturnValue(true);
  });
});
