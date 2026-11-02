import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api/client';
import { authService } from '../../services/auth.service';
import { enrollmentsService } from '../../services/enrollments.service';
import { gradesService } from '../../services/grades.service';
import { periodsService } from '../../services/periods.service';
import { subjectsService } from '../../services/subjects.service';
import { usersService } from '../../services/users.service';

vi.mock('../../api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
const data = { id: 2, name: 'sample' };

describe('API service contracts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the authentication endpoints and unwraps the account response', async () => {
    vi.mocked(api.get).mockResolvedValue({ data });
    vi.mocked(api.post).mockResolvedValue({ data });
    expect(await authService.me()).toEqual(data);
    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(await authService.login('a@b.test', 'pass')).toEqual(data);
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.test', password: 'pass' });
    await authService.logout();
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('keeps the grade summary number typed and sends an optional period filter', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { student_id: 1, period_id: 4, weighted_average: '4.25' } });
    expect(await gradesService.summary(1, 4)).toEqual({ student_id: 1, period_id: 4, weighted_average: 4.25 });
    expect(api.get).toHaveBeenCalledWith('/grades/summary/1', { params: { period_id: 4 } });
    vi.mocked(api.get).mockResolvedValue({ data: { student_id: 1, period_id: null, weighted_average: null } });
    expect((await gradesService.summary(1)).weighted_average).toBeNull();
    expect(api.get).toHaveBeenLastCalledWith('/grades/summary/1', { params: undefined });
  });

  it('requests all user pages until the final short page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: Array.from({ length: 2 }, (_, i) => ({ id: i })) })
      .mockResolvedValueOnce({ data: [{ id: 3 }] });
    expect(await usersService.listAll(2)).toEqual([{ id: 0 }, { id: 1 }, { id: 3 }]);
    expect(api.get).toHaveBeenNthCalledWith(1, '/users/', { params: { offset: 0, limit: 2 } });
    expect(api.get).toHaveBeenNthCalledWith(2, '/users/', { params: { offset: 2, limit: 2 } });
  });

  it('builds CRUD requests for academic resources and user role administration', async () => {
    vi.mocked(api.get).mockResolvedValue({ data });
    vi.mocked(api.post).mockResolvedValue({ data });
    vi.mocked(api.put).mockResolvedValue({ data });
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });
    await subjectsService.list(); await subjectsService.get(3); await subjectsService.create(data as never);
    await subjectsService.update(3, data); await subjectsService.deactivate(3);
    expect(api.get).toHaveBeenCalledWith('/subjects/');
    expect(api.get).toHaveBeenCalledWith('/subjects/3');
    await periodsService.list(); await periodsService.create(data as never); await periodsService.update(4, data); await periodsService.remove(4);
    await enrollmentsService.list(); await enrollmentsService.get(5); await enrollmentsService.create(data as never);
    await enrollmentsService.update(5, 'completed'); await enrollmentsService.cancel(5);
    expect(api.put).toHaveBeenCalledWith('/enrollments/5', { status: 'completed' });
    await gradesService.list(); await gradesService.get(6); await gradesService.create(data as never);
    await gradesService.update(6, data as never); await gradesService.remove(6);
    await usersService.list(5, 10); await usersService.lookup('teacher', 'Ada'); await usersService.get(2);
    await usersService.create(data as never); await usersService.update(2, data as never); await usersService.deactivate(2);
    await usersService.roles(); await usersService.createRole(data as never); await usersService.updateRole(2, data);
    await usersService.setRolePermissions(2, ['grades.manage']); await usersService.permissions(); await usersService.createPermission(data as never);
    await usersService.updatePermission(9, data);
    expect(api.get).toHaveBeenCalledWith('/users/lookup', { params: { role: 'teacher', search: 'Ada', limit: 10 } });
    expect(api.put).toHaveBeenCalledWith('/users/roles/2/permissions', { permissions: ['grades.manage'] });
    expect(api.post).toHaveBeenCalledWith('/users/permissions', data);
  });
});
