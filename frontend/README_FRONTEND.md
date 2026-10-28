# Frontend de Universidad Digital

Aplicación React + TypeScript estricto para el backend FastAPI de Universidad Digital.

## Instalación y comandos

Requiere Node.js 20+ y el backend en `http://127.0.0.1:8000`.

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

La aplicación usa el puerto estricto `3000`: `http://localhost:3000`.

- `npm run build`: compilación de producción.
- `npm run preview`: sirve la compilación.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript estricto.
- `npm run test`: Vitest en modo watch.
- `npm run test:run`: ejecución única para CI.
- `npm run test:coverage`: ejecución con cobertura V8.
- `npm run test:ui`: interfaz gráfica de Vitest.

## Estrategia de pruebas frontend

Las pruebas siguen la pirámide de comportamiento y consultan la interfaz como lo haría una persona:

```text
src/tests/
	setup/       # matchers globales de jest-dom
	unit/        # render inicial, contratos visibles y estados aislados
	interaction/ # userEvent: escritura, teclado, selección y submit
	functional/  # cambios de UI, estados vacíos y rerenderizados
	fixtures/    # datos deterministas que simulan respuestas del servidor
```

`src/tests/setup/setup.ts` se carga desde `vite.config.ts` y registra `jest-dom`. Las pruebas usan `screen` y prefieren `getByRole`, `getByLabelText` y `getByText`; no dependen de clases CSS, `querySelector` ni estado privado. Los nombres se leen como historias de usuario y cada caso sigue Arrange, Act, Assert.

En este dominio no existen componentes `TaskForm` ni `TaskList`. Sus equivalentes reales son `UserCreateForm`/`EnrollmentCreateForm` y `DataTable`: los tests cubren validación de formularios, limpieza conceptual del flujo mediante callbacks, estado ocupado, navegación por teclado, selección, eliminación de filas mediante rerender y estado vacío sin inventar una feature de tareas.

### Mocking

- `vi.fn().mockResolvedValue(undefined)` simula callbacks async como `onSubmit` y permite verificar el contrato observable sin red.
- `vi.mock()` debe reservarse para módulos externos o servicios HTTP completos, por ejemplo `usersService.lookup`, cuando el componente no debe hacer una llamada real.
- Las fixtures contienen datos estables; no se usan tiempos, IDs aleatorios ni servidores reales en estas pruebas de componentes.

### Comandos de calidad

```powershell
npm run test:run
npm run test:coverage
npm run typecheck
npm run lint
```

La cobertura orienta la búsqueda de huecos, no reemplaza escenarios de usuario. Se debe cubrir comportamiento observable y riesgos del negocio; no cada rama trivial, clase CSS o detalle de implementación.

### Prompts útiles para estudiantes

- `Revisa estos tests React y propón tres escenarios de usuario que falten. Usa roles accesibles y no consultes clases CSS.`
- `Analiza el reporte de cobertura y relaciona cada línea sin cubrir con un comportamiento observable; no añadas tests de implementación.`
- `Simplifica este test largo extrayendo una factory de render, manteniendo Arrange-Act-Assert y aislamiento entre casos.`
- `Detecta duplicación entre estos tests de formularios y propone una fixture tipada sin ocultar las acciones del usuario.`

## Arquitectura

`src/api` contiene cliente Axios, tipos y endpoints. `src/services` encapsula las llamadas HTTP; `src/hooks` carga colecciones; `src/context` y `src/auth` mantienen la sesión y los guards; `src/pages`, `src/layouts` y `src/components` contienen la experiencia visual. Los estilos están organizados en `src/styles`.

## Integración y seguridad

`VITE_API_BASE_URL` se define en `.env` y por defecto es `http://127.0.0.1:8000`. Axios usa `withCredentials: true`. La sesión usa `access_token` HttpOnly y el frontend nunca guarda JWT en localStorage, sessionStorage, IndexedDB o variables persistentes. No se usa `Authorization: Bearer`.

Para POST, PUT, PATCH y DELETE, `src/utils/csrf.ts` lee únicamente el valor de la cookie `csrf_token` y el interceptor lo envía como `X-CSRF-Token`. El backend excluye `/auth/login` de CSRF; logout sí requiere el token. Un 401 limpia el usuario en memoria. Los errores de red se distinguen de una sesión no autenticada.

## Rutas, roles y contratos

Rutas públicas: `/login`, `/403`, `/404`. Rutas protegidas: `/dashboard`, `/student/*`, `/teacher/*` y `/admin/*` según el permiso requerido. La autorización real siempre pertenece al backend.

El backend inspeccionado devuelve roles, pero no permisos dentro de `/auth/me`; por eso la interfaz no sustituye la comprobación de permisos del servidor. Usuarios se lista con `offset` y `limit`; las demás colecciones inspeccionadas son listas sin paginación. Periodos se publican en `/api/v1/periods/` desde el router de inscripciones. No existe endpoint de auditoría ni reactivación de usuarios. Las respuestas de inscripciones y calificaciones exponen IDs relacionados, no objetos anidados.

La ruta `/admin/audit` informa honestamente que no hay endpoint disponible. No se inventan estadísticas, límites de créditos, endpoints de reactivación ni respuestas.

## Accesibilidad

Los formularios tienen labels y errores asociados, las tablas usan encabezados, los estados usan `aria-live` o `role=alert`, hay foco visible, navegación por teclado, contraste cuidado y soporte de `prefers-reduced-motion`.

## Validación y pendientes

Se validaron `typecheck`, `build` y `lint`; Vitest cubre CSRF y errores. Las validaciones de login real, permisos, CSRF inválido, conflictos, sesión expirada y flujos de datos requieren backend iniciado y usuarios/datos de prueba. La interfaz consulta recursos reales e incluye formularios y mutaciones para usuarios, materias, periodos, inscripciones y calificaciones. Roles y permisos tienen servicios y guards integrados, pero sus formularios administrativos específicos todavía requieren una iteración adicional.

Para producción se recomienda HTTPS, cookies Secure, CORS explícito al origen desplegado, secretos fuera del repositorio, CSP y pruebas E2E contra datos controlados. `npm install` reportó 3 vulnerabilidades transitorias; deben revisarse con el equipo antes de aplicar actualizaciones mayores.
