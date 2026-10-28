import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EnrollmentCreateForm } from '../../components/forms/CrudForms';
import { periodFixture, studentOption, subjectFixture } from '../fixtures/academic';

describe('EnrollmentCreateForm', () => {
  const renderForm = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
    render(
      <EnrollmentCreateForm
        onSubmit={onSubmit}
        busy={false}
        students={[studentOption]}
        subjects={[subjectFixture]}
        periods={[periodFixture]}
      />,
    );
    return onSubmit;
  };

  it('lets a user select a student with keyboard navigation and submit', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();
    const combobox = screen.getByRole('combobox', { name: 'Estudiante' });

    await user.click(combobox);
    await user.type(combobox, 'Ada');
    await user.keyboard('{ArrowDown}{Enter}');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Materia' }), '11');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Periodo' }), '13');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({ student_id: 7, subject_id: 11, period_id: 13 });
  });

  it('does not submit until the required student has been selected', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Materia' }), '11');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Periodo' }), '13');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
