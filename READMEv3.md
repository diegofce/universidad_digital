# Universidad Digital - Backend FastAPI - Guia de Seguridad Productiva

## Alcance

Backend REST para usuarios, roles, materias, periodos academicos, inscripciones y calificaciones. Usa FastAPI, SQLAlchemy 2, Pydantic 2 y PostgreSQL. La separacion por dominio se mantiene:

```text
backend/
  app/
    auth/          # login y logout
    core/          # configuracion, seguridad, errores y BD
    users/         # usuarios y roles
    subjects/      # materias y docente asignado
    enrollments/   # periodos e inscripciones
    grades/        # calificaciones
    main.py
  requirements.txt
```

Cada dominio conserva `models.py`, `schemas.py`, `services.py` y `routes.py`. Las rutas transportan HTTP, los servicios ejecutan casos de uso, los modelos protegen integridad y los schemas validan contratos. La administracion de identidad y autorizacion permanece en `users/` y no requiere modulos nuevos.

## Perfiles de ambiente

La configuracion se centraliza en `backend/app/core/config.py` y se carga con `python-dotenv` a traves de `pydantic-settings`. No hay secretos hardcodeados.

### Desarrollo

- `APP_ENV=development`.
- Cookies no requieren `Secure` para permitir HTTP local.
- Si no se define CORS, se permiten `http://localhost:3000` y `http://localhost:5173`.
- Usar una base de datos de desarrollo aislada.
- No usar `--reload` en produccion.

### Produccion

- `APP_ENV=production`.
- `APP_COOKIE_SECURE=true` es obligatorio.
- `APP_CORS_ORIGINS` es obligatorio y debe contener solo origenes HTTPS conocidos.
- `ALLOWED_HOSTS` debe contener los hosts publicos esperados.
- `DATABASE_URL` debe apuntar a PostgreSQL con TLS y credenciales gestionadas por el proveedor.
- El secreto JWT debe ser aleatorio, largo y diferente por ambiente.

## Variables de entorno

Copiar `.env.example` a `.env` en la raiz del proyecto y completar los valores locales. El archivo `.env` esta excluido del control de versiones; nunca subir credenciales, secretos JWT ni contraseñas reales.

Ejemplo de desarrollo local:

```env
APP_ENV=development
APP_JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
APP_COOKIE_SECURE=false
APP_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
DATABASE_URL=postgresql+psycopg://usuario:password@localhost:5433/universidad
JWT_EXPIRATION=30
ALLOWED_HOSTS=localhost,127.0.0.1
```

Ejemplo de produccion:

```env
APP_ENV=production
APP_JWT_SECRET=secret-inyectado-por-el-secrets-manager
APP_COOKIE_SECURE=true
APP_CORS_ORIGINS=https://frontend-produccion.com
DATABASE_URL=postgresql+psycopg://usuario:password@db-host:5432/universidad
JWT_EXPIRATION=30
ALLOWED_HOSTS=api.frontend-produccion.com
```

`JWT_EXPIRATION` se expresa en minutos. Nunca subir `.env`, credenciales, secretos JWT ni dumps de base de datos al repositorio.

## Autenticacion

1. El cliente envia email y password a `POST /api/v1/auth/login`.
2. El backend busca un usuario activo y verifica siempre un hash bcrypt. Si el usuario no existe, verifica contra un hash dummy para reducir diferencias de timing.
3. En un login exitoso se emiten `access_token` y `csrf_token`.
4. `access_token` es `HttpOnly`, `SameSite=Lax` y usa `Secure` segun el ambiente.
5. El frontend debe enviar `X-CSRF-Token` con el valor de `csrf_token` en POST, PUT, PATCH y DELETE.
6. `current_user` valida firma, algoritmo, expiracion y usuario activo. `require_permissions` aplica autorizacion declarativa consultando permisos activos asociados al rol del usuario.
7. En login exitoso se actualizan hashes antiguos mediante `needs_update`.
8. `POST /api/v1/auth/logout` revoca las cookies del navegador.

No se almacenan JWT en LocalStorage. El backend no implementa refresh tokens persistentes; el access token es corto y el cliente debe volver a autenticarse cuando expire. Un refresh token futuro debe ser rotatorio, revocable, almacenado como hash y asociado a una sesion/dispositivo.

## Passwords

El backend usa `passlib` con `bcrypt`. Los passwords nunca se almacenan en texto plano ni aparecen en schemas de respuesta. Las operaciones de registro y cambio de password llaman a `hash_password`; el login llama a `verify_password`.

La politica minima actual es de 12 caracteres y maximo 128. Para produccion se recomienda añadir rate limiting externo o en gateway para login, MFA para administradores y bloqueo progresivo ante abuso.

## Roles, permisos y ownership

Los roles y permisos son datos de PostgreSQL, no constantes obligatorias del codigo. Se almacenan en `roles` y `permissions`, se asocian mediante `user_roles` y `role_permissions`, y pueden cambiar de nombre, descripcion o estado desde la API administrativa. `role_audits` conserva las acciones de administracion.

Permisos iniciales recomendados: `users.manage`, `roles.manage`, `subjects.manage`, `enrollments.manage` y `grades.manage`.

- `administrator`: acceso mediante los permisos administrativos asignados a su rol y asignacion de docentes a materias.
- `teacher`: solo ve inscripciones, calificaciones y materias cuyo `teacher_id` coincide con su usuario. Puede actualizar el estado de inscripciones asignadas, pero no modifica calificaciones en este alcance.
- `student`: solo ve sus propias inscripciones y calificaciones; al crear una inscripcion solo puede usar su propio `student_id`. Puede cancelar sus inscripciones.

La asignacion docente se persiste en `subjects.teacher_id` con una clave foranea a `users.id`. Los servicios vuelven a comprobar ownership aunque una ruta ya tenga dependencias, evitando confiar exclusivamente en el controlador. Una materia puede quedar sin docente mediante `teacher_id=null`.

## Creditos y reglas academicas

- Cada materia tiene `credits` entre 1 y 30; el valor predeterminado es 3.
- `MAX_CREDITS_PER_PERIOD` puede configurarse mediante `MAX_CREDITS_PER_PERIOD`; el valor por defecto es 30 y el maximo permitido es 60.
- Una inscripcion nueva rechaza la operacion si la suma de creditos activos del estudiante en el periodo supera el limite.
- Las inscripciones canceladas no consumen creditos.
- `GET /api/v1/grades/summary/{student_id}` calcula el promedio ponderado por creditos y acepta `period_id` como filtro.
- Las materias usan `is_active` y DELETE las desactiva sin eliminar historial academico.
- Los reportes curriculares pueden reutilizar creditos, periodo, estudiante y promedio ponderado.

## CORS, cookies y headers

CORS se configura con `APP_CORS_ORIGINS`, credenciales habilitadas y una lista controlada de metodos y headers. No se usa `*` junto con cookies en produccion. Los headers funcionales permitidos son `Content-Type` y `X-CSRF-Token`.

En despliegues reales:

- Servir API y frontend por HTTPS.
- Mantener `APP_COOKIE_SECURE=true`.
- Configurar proxy TLS, HSTS y `ALLOWED_HOSTS`.
- Mantener `SameSite=Lax` salvo que la topologia requiera otra politica revisada.
- Configurar timeouts, limites de cuerpo y rate limiting en el reverse proxy.

## Base de datos y arranque

El usuario crea solamente la base de datos PostgreSQL. En el evento de startup, `create_tables()` importa todos los modelos y crea las tablas faltantes. No elimina tablas ni datos.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Documentacion OpenAPI: `/docs`.
Health check: `GET /health`.

Para cambios de esquema en instalaciones existentes se debe ejecutar un flujo de Alembic versionado antes del despliegue. `create_all` cubre entornos nuevos, pero no sustituye migraciones controladas.

## Endpoints principales

Todos los endpoints de dominio usan `/api/v1`.

| Metodo           | Ruta                                  | Autorizacion                                             |
| ---------------- | ------------------------------------- | -------------------------------------------------------- |
| POST             | `/auth/login`                         | Publica                                                  |
| GET              | `/auth/me`                            | Usuario autenticado                                      |
| POST             | `/auth/logout`                        | Cookie y CSRF validos                                    |
| POST, GET        | `/users/`                             | Permiso `users.manage`                                   |
| GET, POST        | `/users/roles` y `/users/permissions` | Permiso `roles.manage`                                   |
| PUT              | `/users/roles/{role_id}`              | Permiso `roles.manage`                                   |
| PUT              | `/users/roles/{role_id}/permissions`  | Permiso `roles.manage`                                   |
| PUT              | `/users/permissions/{permission_id}`  | Permiso `roles.manage`                                   |
| GET, PUT, DELETE | `/users/{user_id}`                    | Permiso `users.manage`                                   |
| POST             | `/subjects/`                          | Permiso `subjects.manage`                                |
| GET              | `/subjects/` y `/subjects/{item_id}`  | Usuario autenticado; docentes solo asignadas             |
| PUT, DELETE      | `/subjects/{item_id}`                 | Permiso `subjects.manage`                                |
| POST, GET        | `/periods/`                           | Crear: permiso `enrollments.manage`; leer: autenticado   |
| PUT, DELETE      | `/periods/{item_id}`                  | Permiso `enrollments.manage`                             |
| POST, GET        | `/enrollments/`                       | Estudiante propio, docente asignado o administrador      |
| PUT              | `/enrollments/{item_id}`              | Docente asignado o administrador                         |
| DELETE           | `/enrollments/{item_id}`              | Estudiante propietario, docente asignado o administrador |
| POST             | `/grades/`                            | Permiso `grades.manage`                                  |
| GET              | `/grades/` y `/grades/{item_id}`      | Propietario estudiante, docente asignado o administrador |
| PUT, DELETE      | `/grades/{item_id}`                   | Permiso `grades.manage`                                  |
| GET              | `/grades/summary/{student_id}`        | Propietario, docente asignado o administrador            |

## Checklist OWASP y produccion

- **Broken Access Control:** roles declarativos, filtros por ownership y comprobaciones en servicios.
- **Cryptographic Failures:** bcrypt, JWT secreto externo, cookies seguras y sin LocalStorage.
- **Injection:** SQLAlchemy ORM y schemas tipados; no se interpolan consultas SQL desde entrada.
- **Insecure Design:** CSRF para cookies, minimo privilegio y estados de dominio explicitos.
- **Security Misconfiguration:** perfiles de ambiente, CORS y hosts configurables.
- **Vulnerable Components:** `requirements.txt` fija rangos; ejecutar auditoria de dependencias en CI.
- **Identification and Authentication:** expiracion JWT, hash dummy contra enumeracion temporal y rehash.
- **Software and Data Integrity:** usar CI, revisiones, lockfile y migraciones Alembic revisadas.
- **Logging and Monitoring:** agregar logging estructurado, alertas y auditoria de acciones administrativas en infraestructura.
- **SSRF:** no hay cliente HTTP remoto en el backend actual; revisar cualquier integracion futura.

Antes de declarar un despliegue productivo se deben completar infraestructura HTTPS, secrets manager, backups, observabilidad, rate limiting y pruebas automatizadas contra PostgreSQL. El codigo queda preparado para esos controles y para consumo del frontend, pero esos controles no pueden garantizarse solo desde el repositorio.

## Calidad y pruebas recomendadas

- Ejecutar `python -m compileall backend/app` en CI.
- Ejecutar tests de autenticacion, expiracion JWT, CSRF, roles y ownership con PostgreSQL aislado.
- Probar que un estudiante no puede leer IDs de otro estudiante.
- Probar que un docente no puede consultar una materia no asignada.
- Ejecutar lint, type checking, escaneo de secretos y auditoria de dependencias.
- Usar migraciones Alembic para toda modificacion de esquema despues del primer despliegue.
