import { useState, type FormEvent, type ReactNode } from 'react';
import type {
  Enrollment,
  EnrollmentCreate,
  Grade,
  GradeCreate,
  GradeUpdate,
  Period,
  PeriodCreate,
  PeriodUpdate,
  Subject,
  SubjectCreate,
  SubjectUpdate,
  User,
  UserCreate,
  UserUpdate,
} from '../../api/types';
import { Button } from '../ui/Button';
import { Field } from './Field';

function FormCard({
  title,
  children,
  onSubmit,
  busy,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <form className="panel form-grid" onSubmit={onSubmit} noValidate>
      <h2>{title}</h2>
      {children}
      <Button type="submit" disabled={busy}>
        {busy ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  );
}

export function UserCreateForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: UserCreate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<UserCreate>({
    email: '',
    full_name: '',
    password: '',
    roles: ['student'],
  });
  return (
    <FormCard
      title="Crear usuario"
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Email"
        type="email"
        required
        value={data.email}
        onChange={(e) => setData({ ...data, email: e.target.value })}
      />
      <Field
        label="Nombre completo"
        required
        value={data.full_name}
        onChange={(e) => setData({ ...data, full_name: e.target.value })}
      />
      <Field
        label="Contraseña"
        type="password"
        minLength={12}
        required
        value={data.password}
        onChange={(e) => setData({ ...data, password: e.target.value })}
      />
      <div className="field">
        <label htmlFor="user-role">Rol</label>
        <select
          id="user-role"
          value={data.roles[0]}
          onChange={(e) => setData({ ...data, roles: [e.target.value] })}
        >
          <option value="student">Estudiante</option>
          <option value="teacher">Docente</option>
          <option value="administrator">Administrador</option>
        </select>
      </div>
    </FormCard>
  );
}

export function SubjectCreateForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: SubjectCreate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<SubjectCreate>({ code: '', name: '', credits: 3 });
  return (
    <FormCard
      title="Crear materia"
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Código"
        required
        value={data.code}
        onChange={(e) => setData({ ...data, code: e.target.value })}
      />
      <Field
        label="Nombre"
        required
        value={data.name}
        onChange={(e) => setData({ ...data, name: e.target.value })}
      />
      <Field
        label="Descripción"
        value={data.description ?? ''}
        onChange={(e) => setData({ ...data, description: e.target.value || undefined })}
      />
      <Field
        label="Créditos"
        type="number"
        min={1}
        max={30}
        required
        value={data.credits}
        onChange={(e) => setData({ ...data, credits: Number(e.target.value) })}
      />
      <Field
        label="ID del docente (opcional)"
        type="number"
        min={1}
        value={data.teacher_id ?? ''}
        onChange={(e) =>
          setData({ ...data, teacher_id: e.target.value ? Number(e.target.value) : undefined })
        }
      />
    </FormCard>
  );
}

export function PeriodCreateForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: PeriodCreate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<PeriodCreate>({ name: '', starts_on: '', ends_on: '' });
  return (
    <FormCard
      title="Crear periodo"
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Nombre"
        required
        value={data.name}
        onChange={(e) => setData({ ...data, name: e.target.value })}
      />
      <Field
        label="Fecha de inicio"
        type="date"
        required
        value={data.starts_on}
        onChange={(e) => setData({ ...data, starts_on: e.target.value })}
      />
      <Field
        label="Fecha de finalización"
        type="date"
        required
        value={data.ends_on}
        onChange={(e) => setData({ ...data, ends_on: e.target.value })}
      />
    </FormCard>
  );
}

export function EnrollmentCreateForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: EnrollmentCreate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<EnrollmentCreate>({
    student_id: 0,
    subject_id: 0,
    period_id: 0,
  });
  return (
    <FormCard
      title="Crear inscripción"
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="ID del estudiante"
        type="number"
        min={1}
        required
        value={data.student_id || ''}
        onChange={(e) => setData({ ...data, student_id: Number(e.target.value) })}
      />
      <Field
        label="ID de la materia"
        type="number"
        min={1}
        required
        value={data.subject_id || ''}
        onChange={(e) => setData({ ...data, subject_id: Number(e.target.value) })}
      />
      <Field
        label="ID del periodo"
        type="number"
        min={1}
        required
        value={data.period_id || ''}
        onChange={(e) => setData({ ...data, period_id: Number(e.target.value) })}
      />
    </FormCard>
  );
}

export function GradeCreateForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: GradeCreate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<GradeCreate>({ enrollment_id: 0, score: 0, assessment: '' });
  return (
    <FormCard
      title="Registrar calificación"
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="ID de inscripción"
        type="number"
        min={1}
        required
        value={data.enrollment_id || ''}
        onChange={(e) => setData({ ...data, enrollment_id: Number(e.target.value) })}
      />
      <Field
        label="Puntaje (0 a 5)"
        type="number"
        min={0}
        max={5}
        step={0.01}
        required
        value={data.score}
        onChange={(e) => setData({ ...data, score: Number(e.target.value) })}
      />
      <Field
        label="Evaluación"
        required
        value={data.assessment}
        onChange={(e) => setData({ ...data, assessment: e.target.value })}
      />
    </FormCard>
  );
}

export function UserEditForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: User;
  onSubmit: (data: UserUpdate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<UserUpdate>({
    full_name: initial.full_name,
    is_active: initial.is_active,
    roles: initial.roles,
  });
  return (
    <FormCard
      title={`Editar usuario: ${initial.email}`}
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Nombre completo"
        required
        value={data.full_name ?? ''}
        onChange={(e) => setData({ ...data, full_name: e.target.value })}
      />
      <Field
        label="Nueva contraseña (opcional)"
        type="password"
        minLength={12}
        value={data.password ?? ''}
        onChange={(e) => setData({ ...data, password: e.target.value || undefined })}
      />
      <div className="field">
        <label htmlFor="edit-user-active">Estado</label>
        <select
          id="edit-user-active"
          value={String(data.is_active)}
          onChange={(e) => setData({ ...data, is_active: e.target.value === 'true' })}
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </div>
    </FormCard>
  );
}

export function SubjectEditForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Subject;
  onSubmit: (data: SubjectUpdate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<SubjectUpdate>({
    code: initial.code,
    name: initial.name,
    description: initial.description ?? '',
    credits: initial.credits,
    is_active: initial.is_active,
    teacher_id: initial.teacher_id ?? undefined,
  });
  return (
    <FormCard
      title={`Editar materia: ${initial.code}`}
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Código"
        required
        value={data.code ?? ''}
        onChange={(e) => setData({ ...data, code: e.target.value })}
      />
      <Field
        label="Nombre"
        required
        value={data.name ?? ''}
        onChange={(e) => setData({ ...data, name: e.target.value })}
      />
      <Field
        label="Descripción"
        value={data.description ?? ''}
        onChange={(e) => setData({ ...data, description: e.target.value })}
      />
      <Field
        label="Créditos"
        type="number"
        min={1}
        max={30}
        required
        value={data.credits ?? ''}
        onChange={(e) => setData({ ...data, credits: Number(e.target.value) })}
      />
      <Field
        label="ID del docente"
        type="number"
        min={1}
        value={data.teacher_id ?? ''}
        onChange={(e) =>
          setData({ ...data, teacher_id: e.target.value ? Number(e.target.value) : undefined })
        }
      />
      <div className="field">
        <label htmlFor="edit-subject-active">Estado</label>
        <select
          id="edit-subject-active"
          value={String(data.is_active)}
          onChange={(e) => setData({ ...data, is_active: e.target.value === 'true' })}
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
      </div>
    </FormCard>
  );
}

export function PeriodEditForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Period;
  onSubmit: (data: PeriodUpdate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<PeriodUpdate>({
    name: initial.name,
    starts_on: initial.starts_on,
    ends_on: initial.ends_on,
  });
  return (
    <FormCard
      title={`Editar periodo: ${initial.name}`}
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Nombre"
        required
        value={data.name ?? ''}
        onChange={(e) => setData({ ...data, name: e.target.value })}
      />
      <Field
        label="Inicio"
        type="date"
        required
        value={data.starts_on ?? ''}
        onChange={(e) => setData({ ...data, starts_on: e.target.value })}
      />
      <Field
        label="Finalización"
        type="date"
        required
        value={data.ends_on ?? ''}
        onChange={(e) => setData({ ...data, ends_on: e.target.value })}
      />
    </FormCard>
  );
}

export function EnrollmentEditForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Enrollment;
  onSubmit: (status: Enrollment['status']) => Promise<void>;
  busy: boolean;
}) {
  const [status, setStatus] = useState<Enrollment['status']>(initial.status);
  return (
    <FormCard
      title={`Editar inscripción #${initial.id}`}
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(status);
      }}
    >
      <div className="field">
        <label htmlFor="edit-enrollment-status">Estado</label>
        <select
          id="edit-enrollment-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Enrollment['status'])}
        >
          <option value="active">Activa</option>
          <option value="completed">Completada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>
    </FormCard>
  );
}

export function GradeEditForm({
  initial,
  onSubmit,
  busy,
}: {
  initial: Grade;
  onSubmit: (data: GradeUpdate) => Promise<void>;
  busy: boolean;
}) {
  const [data, setData] = useState<GradeUpdate>({
    score: initial.score,
    assessment: initial.assessment,
  });
  return (
    <FormCard
      title={`Editar calificación #${initial.id}`}
      busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(data);
      }}
    >
      <Field
        label="Puntaje (0 a 5)"
        type="number"
        min={0}
        max={5}
        step={0.01}
        required
        value={data.score ?? ''}
        onChange={(e) => setData({ ...data, score: Number(e.target.value) })}
      />
      <Field
        label="Evaluación"
        required
        value={data.assessment ?? ''}
        onChange={(e) => setData({ ...data, assessment: e.target.value })}
      />
    </FormCard>
  );
}
