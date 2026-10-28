import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
  UserLookup,
  UserUpdate,
} from '../../api/types';
import { usersService } from '../../services/users.service';
import { Button } from '../ui/Button';
import { Field } from './Field';

function FormCard({
  title,
  children,
  onSubmit,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  onCancel?: () => void;
}) {
  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {children}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>
          {busy ? 'Guardando...' : 'Guardar'}
        </Button>
        {onCancel && (
          <Button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function StudentCombobox({
  id,
  options: initialOptions = [],
  value,
  onChange,
}: {
  id: string;
  options?: UserLookup[];
  value: number;
  onChange: (studentId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState(initialOptions);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const lastQuery = useRef('');

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2 || trimmedQuery === lastQuery.current) return;
    lastQuery.current = trimmedQuery;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      void usersService
        .lookup('student', trimmedQuery)
        .then(setOptions)
        .catch(() => setError('No se pudieron cargar los estudiantes.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const filteredOptions = options.filter((student) =>
    `${student.display_name} ${student.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selectedStudent = options.find((student) => student.id === value);
  const selectStudent = (student: UserLookup) => {
    onChange(student.id);
    setQuery(student.display_name);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="field" ref={containerRef}>
      <label htmlFor={id}>Estudiante</label>
      <div className="combobox-control">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${id}-options`}
          aria-expanded={open}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          value={query || selectedStudent?.display_name || ''}
          placeholder="Busca por nombre, apellido o correo"
          onFocus={() => {
            setOpen(true);
            if (selectedStudent) setQuery('');
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(0);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault();
              const student = filteredOptions[activeIndex];
              if (student) selectStudent(student);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="combobox-toggle"
          aria-label="Mostrar estudiantes"
          aria-controls={`${id}-options`}
          aria-expanded={open}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          &#9662;
        </button>
      </div>
      {open && (
        <div className="combobox-menu" id={`${id}-options`} role="listbox">
          {loading && (
            <p className="muted" role="status">
              Buscando estudiantes...
            </p>
          )}
          {!loading && error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && query.trim().length < 2 && (
            <p className="muted">Escribe al menos 2 caracteres para buscar.</p>
          )}
          {!loading && !error && query.trim().length >= 2 && filteredOptions.length === 0 && (
            <p className="muted">No hay estudiantes coincidentes.</p>
          )}
          {!loading &&
            !error &&
            filteredOptions.map((student, index) => (
              <button
                type="button"
                role="option"
                aria-selected={student.id === value}
                id={`${id}-option-${index}`}
                className={index === activeIndex ? 'combobox-option active' : 'combobox-option'}
                key={student.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectStudent(student)}
              >
                <strong>{student.display_name}</strong>
                <span>{student.email}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function UserCreateForm({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (data: UserCreate) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [data, setData] = useState<UserCreate>({
    email: '',
    full_name: '',
    password: '',
    roles: ['student'],
    first_name: '',
    last_name: '',
    identification_number: '',
    birth_date: '',
    phone: '',
  });
  return (
    <FormCard
      title="Crear usuario"
      busy={busy}
      onCancel={onCancel}
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
        label="Nombres"
        required
        value={data.first_name}
        onChange={(e) => setData({ ...data, first_name: e.target.value })}
      />
      <Field
        label="Apellidos"
        required
        value={data.last_name}
        onChange={(e) => setData({ ...data, last_name: e.target.value })}
      />
      <Field
        label="Cédula"
        required
        value={data.identification_number}
        onChange={(e) => setData({ ...data, identification_number: e.target.value })}
      />
      <Field
        label="Fecha de nacimiento"
        type="date"
        required
        value={data.birth_date}
        onChange={(e) => setData({ ...data, birth_date: e.target.value })}
      />
      <Field
        label="Teléfono"
        type="tel"
        required
        value={data.phone}
        onChange={(e) => setData({ ...data, phone: e.target.value })}
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
  teachers,
  onCancel,
}: {
  onSubmit: (data: SubjectCreate) => Promise<void>;
  busy: boolean;
  teachers?: UserLookup[];
  onCancel?: () => void;
}) {
  const [data, setData] = useState<SubjectCreate>({ code: '', name: '', credits: 3 });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherOptions, setTeacherOptions] = useState<UserLookup[]>(teachers ?? []);
  useEffect(() => {
    if (teacherSearch.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      void usersService.lookup('teacher', teacherSearch.trim()).then(setTeacherOptions);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [teacherSearch]);
  return (
    <FormCard
      title="Crear materia"
      busy={busy}
      onCancel={onCancel}
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
      <div className="field">
        <label htmlFor="subject-teacher-search">Buscar docente</label>
        <input
          id="subject-teacher-search"
          value={teacherSearch}
          onChange={(e) => setTeacherSearch(e.target.value)}
          placeholder="Nombre o correo"
        />
        <label htmlFor="subject-teacher">Docente</label>
        <select
          id="subject-teacher"
          required
          value={data.teacher_id ?? ''}
          onChange={(e) => setData({ ...data, teacher_id: Number(e.target.value) })}
        >
          <option value="" disabled>
            Selecciona un docente
          </option>
          {teacherOptions.map((teacher) => (
            <option value={teacher.id} key={teacher.id}>
              {teacher.display_name} ({teacher.email})
            </option>
          ))}
        </select>
      </div>
    </FormCard>
  );
}

export function PeriodCreateForm({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (data: PeriodCreate) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [data, setData] = useState<PeriodCreate>({ name: '', starts_on: '', ends_on: '' });
  return (
    <FormCard
      title="Crear periodo"
      busy={busy}
      onCancel={onCancel}
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
  students,
  subjects,
  periods,
  onCancel,
}: {
  onSubmit: (data: EnrollmentCreate) => Promise<void>;
  busy: boolean;
  students?: UserLookup[];
  subjects: Subject[];
  periods: Period[];
  onCancel?: () => void;
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
      onCancel={onCancel}
      onSubmit={(event) => {
        event.preventDefault();
        if (data.student_id) void onSubmit(data);
      }}
    >
      <StudentCombobox
        id="enrollment-student"
        options={students}
        value={data.student_id}
        onChange={(student_id) => setData({ ...data, student_id })}
      />
      <div className="field">
        <label htmlFor="enrollment-subject">Materia</label>
        <select
          id="enrollment-subject"
          required
          value={data.subject_id || ''}
          onChange={(e) => setData({ ...data, subject_id: Number(e.target.value) })}
        >
          <option value="" disabled>
            Selecciona una materia
          </option>
          {subjects
            .filter((subject) => subject.is_active)
            .map((subject) => (
              <option value={subject.id} key={subject.id}>
                {subject.code} - {subject.name}
              </option>
            ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="enrollment-period">Periodo</label>
        <select
          id="enrollment-period"
          required
          value={data.period_id || ''}
          onChange={(e) => setData({ ...data, period_id: Number(e.target.value) })}
        >
          <option value="" disabled>
            Selecciona un periodo
          </option>
          {periods.map((period) => (
            <option value={period.id} key={period.id}>
              {period.name}
            </option>
          ))}
        </select>
      </div>
    </FormCard>
  );
}

export function GradeCreateForm({
  onSubmit,
  busy,
  enrollments,
  students,
  onCancel,
}: {
  onSubmit: (data: GradeCreate) => Promise<void>;
  busy: boolean;
  enrollments: Enrollment[];
  students?: UserLookup[];
  onCancel?: () => void;
}) {
  const [data, setData] = useState<GradeCreate>({ enrollment_id: 0, score: 0, assessment: '' });
  const [selectedStudentId, setSelectedStudentId] = useState(0);
  return (
    <FormCard
      title="Registrar calificación"
      busy={busy}
      onCancel={onCancel}
      onSubmit={(event) => {
        event.preventDefault();
        if (data.enrollment_id) void onSubmit(data);
      }}
    >
      <StudentCombobox
        id="grade-student-search"
        options={students}
        value={selectedStudentId}
        onChange={(studentId) => {
          setSelectedStudentId(studentId);
          setData({ ...data, enrollment_id: 0 });
        }}
      />
      <div className="field">
        <label htmlFor="grade-enrollment">Inscripción del estudiante</label>
        <select
          id="grade-enrollment"
          required
          value={data.enrollment_id || ''}
          onChange={(e) => setData({ ...data, enrollment_id: Number(e.target.value) })}
        >
          <option value="" disabled>
            Selecciona una inscripción
          </option>
          {enrollments
            .filter(
              (enrollment) =>
                selectedStudentId === 0 || enrollment.student_id === selectedStudentId,
            )
            .map((enrollment) => {
              return (
                <option value={enrollment.id} key={enrollment.id}>
                  #{enrollment.id} - Estudiante no identificado (ID {enrollment.student_id})
                </option>
              );
            })}
        </select>
      </div>
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
  onCancel,
}: {
  initial: User;
  onSubmit: (data: UserUpdate) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [data, setData] = useState<UserUpdate>({
    full_name: initial.full_name,
    is_active: initial.is_active,
    roles: initial.roles,
    first_name: initial.first_name ?? '',
    last_name: initial.last_name ?? '',
    identification_number: initial.identification_number ?? '',
    birth_date: initial.birth_date ?? '',
    phone: initial.phone ?? '',
  });
  return (
    <FormCard
      title={`Editar usuario: ${initial.email}`}
      busy={busy}
      onCancel={onCancel}
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
        label="Nombres"
        required
        value={data.first_name ?? ''}
        onChange={(e) => setData({ ...data, first_name: e.target.value })}
      />
      <Field
        label="Apellidos"
        required
        value={data.last_name ?? ''}
        onChange={(e) => setData({ ...data, last_name: e.target.value })}
      />
      <Field
        label="Cédula"
        required
        value={data.identification_number ?? ''}
        onChange={(e) => setData({ ...data, identification_number: e.target.value })}
      />
      <Field
        label="Fecha de nacimiento"
        type="date"
        required
        value={data.birth_date ?? ''}
        onChange={(e) => setData({ ...data, birth_date: e.target.value })}
      />
      <Field
        label="Teléfono"
        type="tel"
        required
        value={data.phone ?? ''}
        onChange={(e) => setData({ ...data, phone: e.target.value })}
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
  onCancel,
}: {
  initial: Subject;
  onSubmit: (data: SubjectUpdate) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [data, setData] = useState<SubjectUpdate>({
    code: initial.code,
    name: initial.name,
    description: initial.description ?? '',
    credits: initial.credits,
    is_active: initial.is_active,
    teacher_id: initial.teacher_id ?? null,
  });
  return (
    <FormCard
      title={`Editar materia: ${initial.code}`}
      busy={busy}
      onCancel={onCancel}
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
          setData({ ...data, teacher_id: e.target.value ? Number(e.target.value) : null })
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
  onCancel,
}: {
  initial: Period;
  onSubmit: (data: PeriodUpdate) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
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
      onCancel={onCancel}
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
  onCancel,
}: {
  initial: Enrollment;
  onSubmit: (status: Enrollment['status']) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [status, setStatus] = useState<Enrollment['status']>(initial.status);
  return (
    <FormCard
      title={`Editar inscripción #${initial.id}`}
      busy={busy}
      onCancel={onCancel}
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
  onCancel,
}: {
  initial: Grade;
  onSubmit: (data: GradeUpdate) => Promise<void>;
  busy: boolean;
  onCancel?: () => void;
}) {
  const [data, setData] = useState<GradeUpdate>({
    score: initial.score,
    assessment: initial.assessment,
  });
  return (
    <FormCard
      title={`Editar calificación #${initial.id}`}
      busy={busy}
      onCancel={onCancel}
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
