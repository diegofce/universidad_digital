import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollmentsService } from '../../services/enrollments.service';
import { gradesService } from '../../services/grades.service';
import { periodsService } from '../../services/periods.service';
import { subjectsService } from '../../services/subjects.service';
import { usersService } from '../../services/users.service';
import { useEnrollments } from '../../hooks/useEnrollments';
import { useGrades } from '../../hooks/useGrades';
import { usePeriods } from '../../hooks/usePeriods';
import { useSubjects } from '../../hooks/useSubjects';
import { useUsers } from '../../hooks/useUsers';

vi.mock('../../services/enrollments.service', () => ({ enrollmentsService: { list: vi.fn() } }));
vi.mock('../../services/grades.service', () => ({ gradesService: { list: vi.fn() } }));
vi.mock('../../services/periods.service', () => ({ periodsService: { list: vi.fn() } }));
vi.mock('../../services/subjects.service', () => ({ subjectsService: { list: vi.fn() } }));
vi.mock('../../services/users.service', () => ({ usersService: { list: vi.fn(), listAll: vi.fn() } }));

describe('academic data hooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads data, refreshes it on request, and exposes rejected requests', async () => {
    vi.mocked(enrollmentsService.list).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    const enrollmentHook = renderHook(() => useEnrollments());
    await waitFor(() => expect(enrollmentHook.result.current.loading).toBe(false));
    expect(enrollmentHook.result.current.data).toEqual([]);
    act(() => enrollmentHook.result.current.refresh());
    await waitFor(() => expect(enrollmentHook.result.current.error).toEqual(new Error('offline')));

    vi.mocked(gradesService.list).mockResolvedValue([]);
    const gradeHook = renderHook(() => useGrades());
    await waitFor(() => expect(gradeHook.result.current.loading).toBe(false));
    expect(gradesService.list).toHaveBeenCalledOnce();

    vi.mocked(periodsService.list).mockResolvedValue([]);
    const periodHook = renderHook(() => usePeriods());
    await waitFor(() => expect(periodHook.result.current.loading).toBe(false));
    expect(periodsService.list).toHaveBeenCalledOnce();

    vi.mocked(subjectsService.list).mockResolvedValue([]);
    const subjectHook = renderHook(() => useSubjects());
    await waitFor(() => expect(subjectHook.result.current.loading).toBe(false));
    expect(subjectsService.list).toHaveBeenCalledOnce();
  });

  it('skips disabled requests and selects paginated or complete users', async () => {
    const disabled = renderHook(() => useGrades(false));
    await waitFor(() => expect(disabled.result.current.loading).toBe(false));
    expect(gradesService.list).not.toHaveBeenCalled();

    vi.mocked(usersService.list).mockResolvedValue([]);
    vi.mocked(usersService.listAll).mockResolvedValue([]);
    const regular = renderHook(() => useUsers(true));
    await waitFor(() => expect(regular.result.current.loading).toBe(false));
    expect(usersService.list).toHaveBeenCalledOnce();
    const all = renderHook(() => useUsers(true, true));
    await waitFor(() => expect(all.result.current.loading).toBe(false));
    expect(usersService.listAll).toHaveBeenCalledOnce();
  });

  it('settles disabled subject, period, enrollment, and user hooks without requesting data', async () => {
    const enrollmentHook = renderHook(() => useEnrollments(false));
    const periodHook = renderHook(() => usePeriods(false));
    const subjectHook = renderHook(() => useSubjects(false));
    const userHook = renderHook(() => useUsers(false));
    await waitFor(() => {
      expect(enrollmentHook.result.current.loading).toBe(false);
      expect(periodHook.result.current.loading).toBe(false);
      expect(subjectHook.result.current.loading).toBe(false);
      expect(userHook.result.current.loading).toBe(false);
    });
    expect(enrollmentsService.list).not.toHaveBeenCalled();
    expect(periodsService.list).not.toHaveBeenCalled();
    expect(subjectsService.list).not.toHaveBeenCalled();
    expect(usersService.list).not.toHaveBeenCalled();
  });
});
