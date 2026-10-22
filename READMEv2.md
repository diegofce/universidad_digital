# Universidad Digital - Backend FastAPI

## Descripcion

Backend REST para la gestion academica de usuarios, roles, materias, periodos, inscripciones y calificaciones. Esta implementado con FastAPI, SQLAlchemy 2, Pydantic 2 y PostgreSQL.

## Arquitectura aplicada

La aplicacion usa una organizacion por dominio con responsabilidades separadas:

- `routes.py`: endpoints HTTP, dependencias y autorizacion.
- `services.py`: casos de uso, reglas de negocio y transacciones.
- `models.py`: entidades ORM, claves foraneas, restricciones y validadores.
- `schemas.py`: contratos de entrada y salida con Pydantic.
- `core/`: configuracion, sesiones, seguridad, dependencias y errores compartidos.

El modelo `Enrollment` es una entidad explicita porque la relacion estudiante-materia-periodo tiene atributos propios (`status`, `created_at`) y es el punto de relacion con `Grade`. `UserRole` es la tabla asociativa normalizada para la relacion N:M entre usuarios y roles.

## Estructura

```text
backend/
  app/
    auth/
    core/
    users/
    subjects/
    enrollments/
    grades/
    main.py
  requirements.txt
```

## Seguridad

- JWT firmado con HS256 y expiracion configurable.
- JWT almacenado en cookie `HttpOnly`, `SameSite=Lax` y `Secure` configurable.
- Token CSRF de doble envio en la cookie `csrf_token` y header `X-CSRF-Token` para operaciones mutables.
- Passwords procesados con bcrypt mediante `passlib`; nunca se serializa `password_hash`.
- Dependencias `current_user` y `require_roles` para autenticacion y autorizacion.
- Roles permitidos: `administrator`, `teacher`, `student`.
- Minimo privilegio: escritura administrativa en catalogos y calificaciones; estudiantes limitados a sus propios recursos.
- Errores de autenticacion, validacion, dominio y base de datos tienen respuestas controladas.
- CORS y hosts confiables son configurables; en produccion deben definirse explicitamente.

## Flujo de autenticacion

1. El cliente envia email y password a `POST /api/v1/auth/login`.
2. El backend valida el usuario activo y verifica el hash Argon2.
3. Se emiten las cookies `access_token` y `csrf_token`.
4. El frontend envia la cookie automaticamente y el header `X-CSRF-Token` en POST, PUT, PATCH y DELETE.
5. Las rutas protegidas resuelven el usuario desde `current_user` y verifican roles cuando corresponde.
6. `POST /api/v1/auth/logout` elimina ambas cookies.

El frontend no debe guardar tokens en LocalStorage.

## Roles y permisos

| Rol             | Permisos principales                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `administrator` | Gestionar usuarios, materias, periodos, inscripciones y calificaciones.                         |
| `teacher`       | Consultar materias, inscripciones y calificaciones globales; no modifica notas en este alcance. |
| `student`       | Consultar catalogos, crear/cancelar sus inscripciones y consultar sus calificaciones.           |

## Variables de entorno

Crear `backend/.env` a partir de este ejemplo y no subirlo al control de versiones:

```env
DATABASE_URL=postgresql+psycopg://usuario:password@localhost:5433/universidad
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
JWT_EXPIRATION=30
COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:5173
ALLOWED_HOSTS=localhost,127.0.0.1
```

`JWT_EXPIRATION` se expresa en minutos. En produccion usar `COOKIE_SECURE=true`, HTTPS, un secreto aleatorio largo y origenes CORS concretos.

## Instalacion y arranque

Requisitos: Python 3.11 o posterior, PostgreSQL accesible en el puerto `5433` y una base de datos llamada `universidad`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

El backend crea automaticamente las tablas faltantes al iniciar. El usuario solo debe crear la base de datos y configurar sus credenciales; no se ejecutan sentencias destructivas.

Documentacion interactiva: `http://127.0.0.1:8000/docs`.
Health check: `GET http://127.0.0.1:8000/health`.

## Endpoints principales

Todos los endpoints de dominio usan el prefijo `/api/v1`.

| Metodo           | Ruta                     | Acceso                                                          |
| ---------------- | ------------------------ | --------------------------------------------------------------- |
| POST             | `/auth/login`            | Publico                                                         |
| POST             | `/auth/logout`           | Sesion autenticada                                              |
| POST, GET        | `/users/`                | Administrador                                                   |
| GET, PUT, DELETE | `/users/{user_id}`       | Administrador; DELETE desactiva                                 |
| POST, GET        | `/subjects/`             | Crear: administrador; leer: autenticado                         |
| GET, PUT, DELETE | `/subjects/{item_id}`    | Leer: autenticado; modificar: administrador                     |
| POST, GET        | `/periods/`              | Crear: administrador; leer: autenticado                         |
| PUT, DELETE      | `/periods/{item_id}`     | Administrador                                                   |
| POST, GET        | `/enrollments/`          | Estudiante propietario o administrador                          |
| PUT, DELETE      | `/enrollments/{item_id}` | Administrador o propietario para cancelar                       |
| POST, GET        | `/grades/`               | Crear: administrador; leer: estudiante, docente o administrador |
| PUT, DELETE      | `/grades/{item_id}`      | Administrador                                                   |

## Validaciones e integridad

- Email de usuario unico y normalizado en ORM.
- Codigo de materia unico y normalizado en ORM.
- Periodos con `ends_on > starts_on`, validacion Pydantic, ORM y `CHECK` SQL.
- Inscripciones con claves foraneas y restriccion unica sobre estudiante, materia y periodo.
- Estados de inscripcion: `active`, `completed`, `cancelled`.
- Calificaciones entre `0` y `5`, con hasta dos decimales, validado por Pydantic y SQL.
- Eliminacion logica de usuarios e inscripciones; las entidades con dependencias se protegen mediante integridad referencial.

## Pruebas y proximos pasos

El backend queda preparado para ser consumido por el frontend y para pruebas automatizadas. Como siguiente trabajo recomendado:

1. Agregar una suite `pytest` con base de datos aislada y pruebas de autenticacion, roles, CSRF y reglas de negocio.
2. Añadir migraciones versionadas de Alembic para cambios de esquema existentes; el arranque actual crea tablas faltantes para entornos nuevos.
3. Configurar CI con lint, type checking, tests, escaneo de dependencias y analisis de seguridad.
4. Integrar el frontend usando cookies con credenciales y el header `X-CSRF-Token`.
5. Configurar HTTPS, backups, observabilidad, rate limiting de login y rotacion de secretos en produccion.
