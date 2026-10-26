# Universidad Digital - Especificacion del Proyecto

## Proposito

Universidad Digital es un sistema academico con backend FastAPI, PostgreSQL y frontend React. Gestiona autenticacion, usuarios, roles, permisos, materias, periodos, inscripciones y calificaciones.

Este documento es el contexto operativo para otra IA. Debe leerse antes de modificar el proyecto.

## Reglas de trabajo

- Inspeccionar el codigo actual antes de editar.
- Conservar arquitectura y contratos existentes.
- No inventar endpoints, campos ni respuestas.
- No almacenar JWT en LocalStorage, SessionStorage o IndexedDB.
- El backend es la autoridad final de permisos y ownership.
- No ejecutar git add, commit, push, pull, merge, rebase, reset, checkout, switch, stash o limpieza destructiva.
- No modificar la base PostgreSQL actual con migraciones sin confirmar el objetivo y el respaldo.
- No borrar usuarios, tablas ni datos sin identificadores y autorizacion explicita.
- Ejecutar validaciones despues de cada bloque de cambios.

## Estructura

```text
backend/
  app/
    auth/          # login, logout y auth/me
    core/          # configuracion, DB, seguridad, errores y dependencias
    users/         # usuarios, perfiles, roles, permisos y auditoria
    subjects/      # materias y docente asignado
    enrollments/   # periodos e inscripciones
    grades/        # calificaciones y promedio ponderado
    main.py
  alembic/
  requirements.txt
  tests/
frontend/
  src/
    api/ context/ auth/ components/ forms/ hooks/
    layouts/ pages/ routes/ services/ styles/ utils/
  package.json
  vite.config.ts
```

## Backend

### Configuracion

Las variables se cargan desde `.env` mediante `pydantic-settings`. Los hosts locales deben ser consistentes:

```env
DATABASE_URL=postgresql+psycopg://usuario:password@localhost:5433/universidad
APP_JWT_SECRET=secret-de-al-menos-32-caracteres
APP_COOKIE_SECURE=false
APP_CORS_ORIGINS=http://localhost:3000
JWT_EXPIRATION=30
ALLOWED_HOSTS=localhost,127.0.0.1
```

No mezclar `localhost` en un servicio con `127.0.0.1` en el otro cuando se usan cookies.

### Inicio

```powershell
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host localhost --port 8000
```

Swagger: `http://localhost:8000/docs`.
Health: `http://localhost:8000/health`.

### Autenticacion

- `POST /api/v1/auth/login` recibe email y password.
- El JWT se entrega en cookie `access_token` HttpOnly.
- El token CSRF se entrega en cookie `csrf_token` legible.
- POST, PUT, PATCH y DELETE requieren `X-CSRF-Token` con solo el valor de la cookie.
- `GET /api/v1/auth/me` devuelve identidad, perfil, roles y permisos efectivos.
- `POST /api/v1/auth/logout` elimina cookies.
- Nunca usar `Authorization: Bearer` en este proyecto.

### Usuarios y perfiles

`users` conserva credenciales y estado de cuenta. `user_profiles` es una relacion uno-a-uno para:

- `first_name`
- `last_name`
- `identification_number`
- `birth_date`
- `phone`

Crear usuario exige estos datos. Actualizar permite omitir campos, pero rechaza `null` explicito en columnas NOT NULL. La identificacion es unica.

Endpoints principales:

```text
POST /api/v1/users/
GET  /api/v1/users/
GET  /api/v1/users/{id}
PUT  /api/v1/users/{id}
DELETE /api/v1/users/{id}
GET /api/v1/users/lookup?role=teacher|student&search=texto&limit=10
```

El lookup solo devuelve `id`, `display_name`, `email` y `role`; requiere un permiso academico y no equivale a `users.manage`.

### Roles y permisos

Tablas:

```text
roles
permissions
user_roles
role_permissions
role_audits
```

Los permisos efectivos dependen de roles activos y permisos activos. Un rol inactivo no autoriza operaciones.

Permisos base:

```text
users.manage
roles.manage
subjects.manage
enrollments.manage
grades.manage
```

### Materias

- `credits` entre 1 y 30.
- `teacher_id` referencia un usuario activo con rol docente activo.
- `is_active` permite baja y reactivacion logica.
- DELETE desactiva; PUT con `is_active: true` reactiva.
- La asignacion docente se valida en servicio.

### Periodos

Campos reales:

```text
name
starts_on
ends_on
```

`ends_on` debe ser posterior a `starts_on`.

### Inscripciones

```json
{
  "student_id": 3,
  "subject_id": 1,
  "period_id": 1
}
```

Estados:

```text
active, completed, cancelled
```

Un estudiante solo puede crear su propia inscripcion. La combinacion estudiante/materia/periodo es unica. El limite de creditos por periodo se valida en servicio.

### Calificaciones

```json
{
  "enrollment_id": 1,
  "score": 4.5,
  "assessment": "Parcial 1"
}
```

El rango valido es `0..5`. Los docentes solo pueden actuar sobre materias asignadas. El promedio ponderado se calcula con los creditos de las materias:

```text
GET /api/v1/grades/summary/{student_id}
```

## Frontend

Inicio:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

URL: `http://localhost:3000`.

El frontend usa Axios con `withCredentials: true`, lee `csrf_token` y envia `X-CSRF-Token`. No almacena JWT.

Rutas principales:

```text
/login
/dashboard
/admin/users
/admin/roles
/admin/subjects
/admin/periods
/admin/enrollments
/admin/grades
/teacher/subjects
/teacher/enrollments
/teacher/grades
/student/subjects
/student/enrollments
/student/grades
/student/summary
```

Los formularios usan servicios API reales. Las mutaciones refrescan colecciones, conservan drafts cuando fallan, tienen Cancelar y muestran estados de error/exito. Los selectores academicos usan `users/lookup` y no deben pedir `users.manage`.

La navegacion con formularios modificados usa `unstable_usePrompt` y requiere `RouterProvider`/Data Router en `main.tsx`.

## Alembic

Alembic esta configurado en `backend/alembic.ini` y `backend/alembic/env.py`. Migraciones actuales:

```text
profile_001
role_audit_indexes_002
```

Validaciones:

```powershell
cd backend
python -m alembic check
python -m alembic upgrade head
python -m alembic upgrade head --sql
```

No existe una migracion base que cree todas las tablas originales; muchas instalaciones antiguas dependen de `create_tables()`. Antes de introducir una baseline nueva se debe aislar una base PostgreSQL limpia.

## Pruebas

Backend:

```powershell
cd backend
python -m pytest -q
$env:RUN_POSTGRES_E2E='1'; python -m pytest -q
```

El E2E PostgreSQL crea datos temporales, prueba perfil, login, `/auth/me`, lookup autorizado y lookup denegado, y limpia al finalizar. Debe ejecutarse solo contra una base de pruebas verificada.

Frontend:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

## Estado conocido

Validado:

- Backend compila.
- E2E PostgreSQL de perfil y lookup pasa.
- Alembic check y SQL offline pasan.
- Frontend typecheck, lint, Vitest y build pasan.
- Cookies, CSRF, permisos efectivos, roles inactivos y ownership estan cubiertos por codigo y pruebas existentes.

Pendiente de validacion manual:

- Flujo completo en navegador con login, lookup, CRUD y CSRF.
- Navegacion con draft y confirmacion de salida.
- PostgreSQL limpio desde cero con una baseline completa.
- Prueba E2E de navegador real, por ejemplo Playwright.
- Resolver la advertencia de compatibilidad futura Starlette/TestClient/httpx.
- Revisar warnings de bundle de Zod en build.

No declarar produccion lista solo por compilar. La evidencia debe incluir pruebas backend/frontend, validacion de permisos, migraciones y flujo manual en navegador.
