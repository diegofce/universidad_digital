# University Academic Management API

API REST en FastAPI para usuarios y roles, materias, periodos académicos, inscripciones y calificaciones. El backend organiza cada dominio en `models.py` (SQLAlchemy), `schemas.py` (Pydantic), `services.py` (casos de uso) y `routes.py` (HTTP). Las sesiones, configuración, autenticación y errores compartidos viven en `backend/app/core/`.

## Requisitos y ejecución

- Python 3.11 o posterior.
- PostgreSQL 18 (o compatible) y una base de datos creada para la aplicación.
- Instalar dependencias desde `backend`: `python -m pip install -r requirements.txt`.
- Definir `DATABASE_URL` y `JWT_SECRET_KEY` (mínimo 32 caracteres) mediante entorno o un archivo `.env` local. Usa `postgresql+psycopg://...` y un secreto aleatorio largo, distinto por entorno. La aplicación no arranca si falta alguno. No subir `.env` al control de versiones.
- Iniciar desde `backend`: `uvicorn app.main:app --reload`.
- La documentación interactiva está en `/docs`; health check en `/health`.

La aplicación no crea tablas automáticamente. Antes de exponerla, configura Alembic y aplica migraciones revisadas. El paquete está incluido en `requirements.txt`; no se inicializa esquema en tiempo de arranque para evitar cambios implícitos en producción.

## Endpoints principales

Prefijo API: `/api/v1`.

| Método            | Ruta                             | Acceso                                                                |
| ----------------- | -------------------------------- | --------------------------------------------------------------------- |
| POST              | `/auth/login`                    | Público; establece cookie HttpOnly                                    |
| POST              | `/auth/logout`                   | Cierra sesión                                                         |
| POST, GET         | `/users/`                        | Administrador                                                         |
| GET, PUT, DELETE  | `/users/{user_id}`               | Administrador                                                         |
| POST, GET         | `/subjects/`                     | Escritura: administrador; lectura: usuario autenticado                |
| GET, PUT, DELETE  | `/subjects/{item_id}`            | Lectura: usuario autenticado; escritura: administrador                |
| POST, GET         | `/periods/`                      | Escritura: administrador; lectura: usuario autenticado                |
| PUT, DELETE       | `/periods/{item_id}`             | Administrador                                                         |
| POST, GET         | `/enrollments/`                  | Estudiante (solo sí mismo) o administrador                            |
| DELETE            | `/enrollments/{item_id}`         | Estudiante propietario o administrador                                |
| POST, PUT, DELETE | `/grades/` y `/grades/{item_id}` | Escritura: administrador; borrado: administrador                      |
| GET               | `/grades/` y `/grades/{item_id}` | Estudiante ve sus notas; docente/administrador pueden consultar todas |

Los roles admitidos son `administrator`, `teacher` y `student`. El primer administrador debe aprovisionarse mediante un proceso controlado de administración de datos, asignándole una contraseña procesada con el mismo servicio de hash; no existe un registro público de administradores.

## Modelo de datos

- `users` y `user_roles` modelan usuarios y su relación N:M con roles. `user_roles` almacena la asociación normalizada.
- `subjects` modela el catálogo de materias.
- `academic_periods` almacena periodos con fechas de inicio y fin validadas.
- `enrollments` vincula estudiante, materia y periodo; una restricción única evita duplicar la misma inscripción.
- `grades` vincula cada calificación con una inscripción; admite valores entre 0 y 5 con dos decimales.

## Seguridad y alcance

Las contraseñas se almacenan con hash Argon2 mediante `pwdlib`; JWT se entrega en cookie `HttpOnly`, `Secure` y `SameSite=Lax`. `Secure` requiere HTTPS, por lo que el login de desarrollo local por HTTP no conservará la cookie en el navegador. No se guardan JWT en LocalStorage. Las rutas aplican dependencias de autenticación y roles, los schemas limitan formatos y longitudes, y las respuestas omiten hashes.

El manejo centralizado traduce errores esperados del dominio. Configura además HTTPS, CORS con orígenes explícitos, protección CSRF adecuada al despliegue con cookies, limitación de intentos de login, rotación de secretos, logging seguro, copias de seguridad y monitoreo en la infraestructura.

El modelo base no define asignación de docentes a materias o grupos; por ello el rol docente tiene lectura global de calificaciones y no puede modificarlas. Antes de habilitar calificación por docentes, agrega una relación de asignación y autoriza cada operación según ella. Tampoco se implementan reportes académicos en este alcance.

## Respuestas de revisión del proyecto

1. **¿Dónde se define la conexión a la base de datos?** En `backend/app/core/database.py`, mediante `create_engine(settings.database_url, ...)`.
2. **¿Qué clase base se utiliza para los modelos ORM?** `Base`, que hereda de `sqlalchemy.orm.DeclarativeBase`, en `backend/app/core/database.py`.
3. **¿Qué archivo concentra el manejo centralizado de errores?** `backend/app/core/errors.py`.
4. **¿Qué excepción se usa cuando no existe un recurso?** `AppError` con código HTTP `404`; por ejemplo, se lanza desde los servicios con mensajes como `User not found`.
5. **¿Dónde se realiza el hashing de contraseñas?** En `backend/app/core/security.py`, mediante `hash_password()` y `PasswordHash.recommended()`.
6. **¿En qué archivo se declara la tabla de relación N:M entre usuarios y roles?** En `backend/app/users/models.py`, con el modelo `UserRole` y la tabla `user_roles`.
7. **¿Qué modelo contiene el campo `hashed_password`?** Ninguno contiene ese nombre. El modelo `User`, en `backend/app/users/models.py`, usa el campo `password_hash`.
8. **¿Qué esquema de Pydantic contiene el campo `password`?** Principalmente `UserCreate`; también lo contienen `UserUpdate` y `LoginRequest`, en `backend/app/users/schemas.py`.
9. **¿Qué esquema de respuesta omite el hash de contraseña?** `UserResponse`, en `backend/app/users/schemas.py`, porque no declara `password_hash`.
10. **¿Dónde se valida que el email sea único al crear un usuario?** En `backend/app/users/services.py`, dentro de `create_user()`, capturando `IntegrityError`; la restricción `unique=True` está en `User.email`.
11. **¿Dónde se define el endpoint `POST /users`?** En `backend/app/users/routes.py`, con `@router.post("/")`; con el prefijo global, la ruta es `/api/v1/users/`.
12. **¿Cómo se obtiene la sesión de BD en las rutas?** Mediante `Annotated[Session, Depends(get_db)]`, normalmente alias `Db`, usando `get_db()` de `backend/app/core/database.py`.
13. **¿Qué archivo registra todos los routers de la API?** `backend/app/main.py`, mediante varias llamadas a `app.include_router(...)`.
14. **¿Qué endpoint expone el health check?** `GET /health`, definido en `backend/app/main.py`.
15. **¿Qué entidad representa las materias?** El modelo `Subject`, en `backend/app/subjects/models.py`.
16. **¿Dónde se controla que el código de materia sea único?** En `Subject.code` con `unique=True` y en `create_subject()`/`update_subject()` de `backend/app/subjects/services.py`, que capturan `IntegrityError`.
17. **¿Qué entidad representa los periodos académicos?** El modelo `AcademicPeriod`, en `backend/app/enrollments/models.py`.
18. **¿Dónde se valida que `end_date` sea mayor o igual a `start_date`?** El proyecto usa `ends_on` y `starts_on`, no `end_date` y `start_date`. La validación está en `PeriodCreate` de `backend/app/enrollments/schemas.py`, en `update_period()` de `backend/app/enrollments/services.py` y en el `CheckConstraint` del modelo. Actualmente exige que `ends_on` sea estrictamente mayor que `starts_on`.
19. **¿Qué entidad representa la inscripción de un estudiante a una materia?** El modelo `Enrollment`, en `backend/app/enrollments/models.py`.
20. **¿Qué restricción evita inscripciones duplicadas?** `UniqueConstraint("student_id", "subject_id", "period_id", name="uq_enrollment_student_subject_period")`, en `Enrollment`.
21. **¿Dónde se verifica la existencia de usuario, materia y periodo antes de inscribir?** En `create_enrollment()` de `backend/app/enrollments/services.py`, validando `User`, `Subject` y `AcademicPeriod`.
22. **¿Qué enum define el estado de la inscripción?** Ninguno. El código actual no tiene un enum ni un campo de estado en `Enrollment`.
23. **¿Qué entidad representa las calificaciones?** El modelo `Grade`, en `backend/app/grades/models.py`.
24. **¿Dónde se valida el rango de la calificación (`0–100`)?** El código actual valida `0–5`, no `0–100`: en `GradeCreate` y `GradeUpdate` de `backend/app/grades/schemas.py`, y mediante `ck_grade_score_range` en `backend/app/grades/models.py`.
25. **¿En qué archivo se define el CRUD de calificaciones?** En `backend/app/grades/services.py`; los endpoints correspondientes están en `backend/app/grades/routes.py`.
26. **¿Qué capa contiene la lógica de negocio?** La capa de servicios, en los archivos `services.py` de cada dominio.
27. **¿Qué capa contiene los endpoints?** La capa de rutas, en los archivos `routes.py` de cada dominio.
28. **¿Qué capa contiene los modelos ORM?** La capa de modelos, en los archivos `models.py` de cada dominio.
29. **¿Qué archivo lista las dependencias del backend?** `backend/requirements.txt`.
30. **¿Dónde está documentada la estructura y requisitos básicos?** En este `README.md`, en las secciones de requisitos y ejecución, endpoints, modelo de datos y seguridad.
