import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Enrollment, Grade, User } from '../../api/types';
import {
  GradeCreateForm,
  GradeEditForm,
  EnrollmentCreateForm,
  EnrollmentEditForm,
  PeriodCreateForm,
  PeriodEditForm,
  SubjectCreateForm,
  SubjectEditForm,
  UserEditForm,
} from '../../components/forms/CrudForms';
import { periodFixture, studentOption, subjectFixture } from '../fixtures/academic';
import { usersService } from '../../services/users.service';

vi.mock('../../services/users.service', () => ({ usersService: { lookup: vi.fn() } }));

const teacher = { ...studentOption, id: 21, role: 'teacher' as const };
const userFixture: User = {
  id: 7, email: 'ada@example.com', full_name: 'Ada Student', is_active: true,
  created_at: '2026-01-01T00:00:00Z', roles: ['student'], first_name: 'Ada', last_name: 'Student',
  identification_number: 'STUDENT-001', birth_date: '2000-01-15', phone: '+573001112233',
};
const enrollment: Enrollment = {
  id: 31, student_id: 7, subject_id: 11, period_id: 13, status: 'active', created_at: '2026-01-01T00:00:00Z',
};
const grade: Grade = {
  id: 41, enrollment_id: 31, score: 4, assessment: 'Parcial', created_at: '2026-01-01T00:00:00Z',
};

describe('academic forms', () => {
  beforeEach(() => {
    vi.mocked(usersService.lookup).mockReset().mockResolvedValue([studentOption]);
  });

  it('submits subject fields with numeric credits and selected teacher', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SubjectCreateForm onSubmit={onSubmit} busy={false} teachers={[teacher]} />);
    await user.type(screen.getByRole('textbox', { name: 'Código' }), 'BIO-101');
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Biología');
    await user.type(screen.getByRole('textbox', { name: 'Descripción' }), 'Ciencias de la vida');
    await user.clear(screen.getByRole('spinbutton', { name: 'Créditos' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Créditos' }), '4');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Docente' }), '21');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith({ code: 'BIO-101', name: 'Biología', description: 'Ciencias de la vida', credits: 4, teacher_id: 21 });
  });

  it('submits a period date range and cancels an edit on request', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PeriodCreateForm onSubmit={onSubmit} busy={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), '2026-2');
    await user.type(screen.getByLabelText('Fecha de inicio'), '2026-07-01');
    await user.type(screen.getByLabelText('Fecha de finalización'), '2026-12-20');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: '2026-2', starts_on: '2026-07-01', ends_on: '2026-12-20' });

    const onCancel = vi.fn();
    render(<PeriodEditForm initial={periodFixture} onSubmit={vi.fn()} busy={false} onCancel={onCancel} />);
    await user.click(screen.getAllByRole('button', { name: 'Cancelar' })[0]);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('submits selected enrollment and score for a grade', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GradeCreateForm onSubmit={onSubmit} busy={false} enrollments={[enrollment]} students={[studentOption]} />);
    const student = screen.getByRole('combobox', { name: 'Estudiante' });
    await user.click(student);
    await user.type(student, 'Ada');
    await user.keyboard('{ArrowDown}{Enter}');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Inscripción del estudiante' }), '31');
    await user.clear(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }), '4.5');
    await user.type(screen.getByRole('textbox', { name: 'Evaluación' }), 'Final');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledWith({ enrollment_id: 31, score: 4.5, assessment: 'Final' });
  });

  it('submits changes to existing user, subject, and grade records', async () => {
    const user = userEvent.setup();
    const updateUser = vi.fn().mockResolvedValue(undefined);
    const updateSubject = vi.fn().mockResolvedValue(undefined);
    const updateGrade = vi.fn().mockResolvedValue(undefined);
    const view = render(<UserEditForm initial={userFixture} onSubmit={updateUser} busy={false} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'false');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    view.unmount();

    const subjectView = render(<SubjectEditForm initial={subjectFixture} onSubmit={updateSubject} busy={false} />);
    await user.clear(screen.getByRole('textbox', { name: 'Nombre' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Álgebra');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'false');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateSubject).toHaveBeenCalledWith(expect.objectContaining({ name: 'Álgebra', is_active: false }));
    subjectView.unmount();

    render(<GradeEditForm initial={grade} onSubmit={updateGrade} busy={false} />);
    await user.clear(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Puntaje (0 a 5)' }), '3.75');
    await user.click(screen.getAllByRole('button', { name: 'Guardar' }).at(-1)!);
    expect(updateGrade).toHaveBeenCalledWith({ score: 3.75, assessment: 'Parcial' });
  });

  it('submits edited dates and enrollment status', async () => {
    const user = userEvent.setup();
    const updatePeriod = vi.fn().mockResolvedValue(undefined);
    const periodView = render(<PeriodEditForm initial={periodFixture} onSubmit={updatePeriod} busy={false} />);
    await user.clear(screen.getByRole('textbox', { name: 'Nombre' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), '2026-2');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updatePeriod).toHaveBeenCalledWith({ name: '2026-2', starts_on: '2026-01-01', ends_on: '2026-06-30' });
    periodView.unmount();

    const updateEnrollment = vi.fn().mockResolvedValue(undefined);
    render(<EnrollmentEditForm initial={enrollment} onSubmit={updateEnrollment} busy={false} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'cancelled');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateEnrollment).toHaveBeenCalledWith('cancelled');
  });

  it('shows the student lookup empty and API error states and closes the menu with Escape', async () => {
    const user = userEvent.setup();
    vi.mocked(usersService.lookup).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    render(<EnrollmentCreateForm onSubmit={vi.fn()} busy={false} subjects={[subjectFixture]} periods={[periodFixture]} />);
    const student = screen.getByRole('combobox', { name: 'Estudiante' });
    await user.type(student, 'NoMatch');
    expect(await screen.findByText('No hay estudiantes coincidentes.')).toBeVisible();
    expect(usersService.lookup).toHaveBeenCalledWith('student', 'NoMatch');

    await user.clear(student);
    await user.type(student, 'Offline');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los estudiantes.');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
