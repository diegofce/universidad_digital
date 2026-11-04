# Cypress E2E

## Alcance y clasificación

El dominio no contiene tareas. La ruta persistente implementada aquí crea una materia y la consulta de nuevo. Las pruebas se separan por objetivo:

- **E2E real** (`auth.cy.ts`, `navigation.cy.ts`, `academic-subjects.cy.ts`): navegador, React, FastAPI y PostgreSQL. La única prueba que escribe está omitida por defecto y requiere activación explícita de una BD QA aislada.
- **Integración simulada / resiliencia** (`resilience.cy.ts`): las respuestas API se inyectan con `cy.intercept`; verifica cómo responde la UI a validación local, 401, 500, 504, desconexión y respuestas problemáticas. No valida FastAPI ni persistencia.

## Versiones

- Node.js `>=20.19.0` (validado con Node 24.14.0 en esta máquina).
- npm `>=10` (validado con npm 11.10.0).
- Cypress `^15.7.0` (el lockfile fija la versión que resolvió npm).
- Vite 7, Vitest 4 y TypeScript 5.9 se comparten con el frontend; el requisito de Node de Vite también queda cubierto.
- Chrome solo es necesario para `cy:run:chrome` y debe estar instalado en el host.

## Instalar dependencias

Desde `frontend`:

```powershell
npm ci
```

El proyecto requiere descargar Cypress y su binario en la primera instalación. La consistencia declarativa se puede comprobar con `npm ls --depth=0`.

## Configuración local

Configura estas variables en el entorno del proceso, usando secretos locales y nunca el archivo de ejemplo como credenciales reales:

```powershell
$env:CYPRESS_BASE_URL = 'http://localhost:3000'
$env:VITE_API_BASE_URL = 'http://localhost:8000'
$env:CYPRESS_API_URL = 'http://localhost:8000/api/v1'
$env:CYPRESS_ADMIN_EMAIL = 'cuenta-admin-qa@ejemplo.test'
$env:CYPRESS_ADMIN_PASSWORD = '<secreto-local>'
$env:CYPRESS_TEACHER_SEARCH = 'qa'
$env:CYPRESS_RESPONSE_BUDGET_MS = '10000'
$env:CYPRESS_ALLOW_DB_WRITES = 'false'
```

El frontend y el API deben usar el mismo hostname (`localhost`) en desarrollo. La configuración de ejemplo del frontend usa `127.0.0.1`; no la combines con la SPA en `localhost` para estas pruebas, porque las cookies `SameSite=Lax` y el manejo de sesión dependen del host. El login usa la cookie HttpOnly real; no se lee ni se guarda JWT en localStorage. `cy.session()` verifica la sesión restaurada mediante `GET /auth/me`.

`CYPRESS_ADMIN_EMAIL` y `CYPRESS_ADMIN_PASSWORD` deben pertenecer a un administrador de QA activo con permisos reales. No hay auto-registro público ni fixture de credenciales válidas.

## Preparar PostgreSQL de QA (obligatorio para escritura)

No hay `docker-compose` ni seed QA en este repositorio. El `.env.example` existente apunta a la base `universidad`, no a una base aislada. No ejecutes el E2E de escritura hasta que un DBA/administrador confirme una base independiente, por ejemplo `universidad_qa`, y que no reutiliza producción ni la base habitual de desarrollo.

1. Crea `universidad_qa` en una instancia PostgreSQL de QA aislada con un rol de BD limitado a esa base. Ajusta host, puerto, usuario y contraseña al entorno; no copies valores de `.env` al repositorio.
2. En una terminal backend, configura `DATABASE_URL=postgresql+psycopg://<rol>:<secreto>@<host>:<puerto>/universidad_qa`, `APP_ENV=development`, `APP_COOKIE_SECURE=false` y `APP_CORS_ORIGINS=http://localhost:3000`. `backend/app/main.py` llama `create_tables()` al arrancar; no ejecutes migraciones destructivas.
3. El primer administrador no puede crearse por API: el README raíz indica que debe provisionarse por un proceso controlado y con el hash de contraseña del servicio de seguridad. Este repositorio no incluye un bootstrap/seed seguro, así que esa tarea debe realizarla el responsable de la base QA. Confirma que existan los roles y permisos `administrator`, `teacher` y `subjects.manage` antes de probar.
4. Inicia el backend desde `backend` con `uvicorn app.main:app --reload`. La salud se consulta en `http://localhost:8000/health`.
5. Con el administrador QA, crea un docente desde `/admin/users` con los campos del formulario y rol `teacher`. `CYPRESS_TEACHER_SEARCH` debe ser una subcadena de al menos dos caracteres que encuentre ese docente activo. La creación de usuario requiere `users.manage`.
6. Inicia el frontend desde `frontend` con `npm run dev` (Vite escucha en el puerto 3000). Ejecuta Cypress desde otra terminal con las mismas variables.

La aplicación no contiene un seed idempotente de roles, permisos, administrador o docente. Si ese provisionamiento no está disponible, deja `CYPRESS_ALLOW_DB_WRITES=false`: la creación persistente queda omitida y no se debe redirigir el E2E a otra base.

La prueba registra el ID devuelto por el `POST /subjects/` y al terminar lo desactiva mediante el `DELETE /subjects/{id}` real (el endpoint es soft-delete y preserva historial). El cleanup solo usa el ID creado por esa ejecución. Si el proceso se interrumpe después de crear, el registro puede quedar activo; se identifica por código `QA<timestamp>` y debe revisarlo un administrador QA. No se borran ni desactivan datos preexistentes.

## Ejecutar

```powershell
cd frontend
npm run cy:open
npm run cy:run
npm run cy:run:chrome
npx cypress run --spec cypress/e2e/resilience.cy.ts
npx cypress run --spec cypress/e2e/auth.cy.ts
```

`cy:run` usa Electron headless. `cy:run:chrome` requiere Chrome instalado. Para permitir el test persistente, únicamente después de verificar la URL de BD del proceso FastAPI:

```powershell
$env:CYPRESS_ALLOW_DB_WRITES = 'true'
npx cypress run --spec cypress/e2e/academic-subjects.cy.ts
```

## Rutas API reales

| Método | Ruta | Uso en el suite |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login real, establece `access_token` HttpOnly y `csrf_token` |
| `GET` | `/api/v1/auth/me` | Verificar / restaurar sesión y perfil |
| `GET` | `/api/v1/subjects/` | Dashboard, lista y lectura tras recarga |
| `POST` | `/api/v1/subjects/` | Crear materia, requiere `subjects.manage` y CSRF |
| `GET` | `/api/v1/users/lookup?role=teacher&search=...&limit=10` | Buscar docente activo con permiso académico |
| `DELETE` | `/api/v1/subjects/{id}` | Cleanup del registro creado; desactiva, no borra físicamente |

Las comprobaciones simuladas no sustituyen ni se reportan como validación de estos endpoints reales. El endpoint de escritura valida status, JSON de respuesta, datos listados y persistencia después de navegar de nuevo.

## Limitaciones conocidas

- No hay entidad de tareas; se prueba materia por ser la entidad real del flujo CRUD.
- No hay bootstrap QA versionado para crear roles, permisos ni el primer administrador. Sin esa preparación, auth/navegación y persistencia real no son ejecutables.
- Las respuestas 500/504, desconexión, login inválido, sesión expirada, cuerpo corrupto y parcial de `resilience.cy.ts` son stubs; solo prueban la reacción de la UI.
- El frontend no valida la forma de una respuesta `200` de materias antes de renderizarla. La prueba parcial confirma lo que muestra una respuesta incompleta; no acredita que FastAPI real produzca ese payload.
- El suite no elimina filas: el endpoint de materias conserva historial y solo permite desactivar.

## Solución de problemas

- **`Cypress binary is missing`**: completa `npm ci` con acceso al CDN de Cypress y ejecuta `npx cypress verify`.
- **CORS o login sin sesión**: usa `localhost` tanto en `VITE_API_BASE_URL` como en `CYPRESS_API_URL`; revisa `APP_CORS_ORIGINS` y `APP_COOKIE_SECURE=false` en local.
- **401 al restaurar sesión**: comprueba credenciales, `access_token`, reloj/expiración y que SPA/API compartan hostname.
- **No se encuentra docente**: asegúrate de que existe un usuario activo de rol `teacher` en QA y ajusta `CYPRESS_TEACHER_SEARCH` a un texto de al menos dos caracteres que coincida.
- **Materia duplicada o no se limpia**: el código lleva timestamp; si Cypress se cerró a la fuerza, revisa únicamente el código `QA<timestamp>` en la base QA y desactiva esa materia manualmente.
- **Chrome no está disponible**: ejecuta `npm run cy:run` con Electron o instala Chrome en el agente.
