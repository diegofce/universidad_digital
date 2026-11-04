# Auditoría QA de pruebas frontend

## 1. Objetivo

Esta auditoría evalúa la calidad de la suite frontend de Universidad Digital contra el checklist académico de testing. Se revisaron las pruebas Vitest/Testing Library, la configuración de Vite/Vitest, los fixtures y los componentes reales equivalentes a los ejemplos `TaskForm`/`TaskList`.

Los equivalentes en este dominio son:

- Formularios académicos en `src/components/forms/CrudForms.tsx`.
- Gestión de roles y permisos en `src/components/forms/RolePermissionsWorkspace.tsx`.
- Listas/tablas académicas mediante `src/components/tables/DataTable.tsx` y `src/pages/WorkspacePage.tsx`.

No se introdujeron componentes ficticios ni llamadas a APIs externas.

## 2. Stack y configuración

- React + TypeScript + Vite.
- Vitest 4 con provider V8.
- React Testing Library y `@testing-library/user-event`.
- `jsdom` como entorno de prueba.
- `@testing-library/jest-dom` cargado desde `src/tests/setup/setup.ts`.
- Axios mockeado en las pruebas unitarias de servicios.
- Cypress separado para E2E contra servicios reales.

La configuración está en `vite.config.ts`. La cobertura incluye `src/**/*.{ts,tsx}` y excluye tests, tipos, configuración y entrypoints.

## 3. Estructura observada

```text
src/tests/
  fixtures/
  functional/
  interaction/
  setup/
  unit/
```

La separación es mantenible:

- `unit`: cliente Axios, servicios, hooks y formularios pequeños.
- `interaction`: formularios, rutas, autenticación, dashboard y workspace.
- `functional`: comportamiento de tabla.
- `fixtures`: datos académicos reutilizables.
- `setup`: configuración global de Testing Library.

No hay archivos monolíticos de infraestructura; `workspace-page.test.tsx` es el archivo más amplio porque cubre el flujo de trabajo académico completo.

## 4. Checklist de cumplimiento

| Criterio                    | Estado  | Evidencia                                                                                                     | Observaciones                                                                                                                                                                                                                                 |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Filosofía de testing     | CUMPLE  | `src/tests/interaction/*`, `src/tests/functional/data-table.test.tsx`                                         | Se validan textos, roles, estados, navegación y callbacks observables. No se encontraron `querySelector`, `data-testid` ni acceso a estado privado en los tests.                                                                              |
| 2. Estructura               | CUMPLE  | `src/tests/`, `vite.config.ts`, `src/tests/setup/setup.ts`                                                    | Existen carpetas por intención, setup global y `jsdom`.                                                                                                                                                                                       |
| 3. Formularios              | PARCIAL | `academic-forms.test.tsx`, `enrollment-form.test.tsx`, `user-create-form.test.tsx`, `workspace-page.test.tsx` | Hay cobertura de formularios reales, validación HTML, datos válidos, errores de lookup, estados busy y envío. Faltan casos sistemáticos de espacios en blanco, texto extremo, doble envío y persistencia de draft para todos los formularios. |
| 4. Listas y tablas          | PARCIAL | `functional/data-table.test.tsx`, `workspace-page.test.tsx`, `dashboard.test.tsx`                             | Se cubren vacío, múltiples filas, rerender, paginación, acciones de actualización/desactivación y estados condicionales. No todos los listados tienen casos independientes de error, vacío y re-render.                                       |
| 5. Mocking                  | CUMPLE  | `unit/services.test.ts`, `unit/data-hooks.test.tsx`, `interaction/*`                                          | Los mocks representan servicios o hooks externos al componente. Se validan argumentos y resultados. No se realizan llamadas reales desde Vitest.                                                                                              |
| 6. Arrange-Act-Assert       | CUMPLE  | Suite completa                                                                                                | Los tests preparan fixtures/mocks, ejecutan acciones con `userEvent` y validan resultado visible o contrato de callback.                                                                                                                      |
| 7. Accesibilidad            | CUMPLE  | `login-page.test.tsx`, `enrollment-form.test.tsx`, `academic-forms.test.tsx`, `dashboard.test.tsx`            | Predominan queries por role, label y texto; existen pruebas de teclado y navegación accesible.                                                                                                                                                |
| 8. Buenas prácticas         | PARCIAL | `unit/services.test.ts`, `interaction/workspace-page.test.tsx`                                                | Se usa `screen` y no hay selectores frágiles en Vitest. `services.test.ts` agrupa muchos contratos en un único test y `workspace-page.test.tsx` concentra varios flujos; funciona, pero aumenta el coste de diagnóstico.                      |
| 9. Cobertura y casos límite | PARCIAL | `data-hooks.test.tsx`, `role-permissions.test.tsx`, `dashboard.test.tsx`, `academic-forms.test.tsx`           | Hay casos felices, errores HTTP, estados vacíos, carga, permisos, sesión expirada y lookup sin resultados. Faltan algunos errores de red por servicio y combinaciones de campos inválidos.                                                    |
| 10. Uso responsable de IA   | PARCIAL | Revisión de nombres, mocks y asserts en `src/tests/`                                                          | No hay tests genéricos `should work`, asserts triviales ni duplicación evidente. Persisten algunos tests largos y datos repetidos que conviene explicar/revisar manualmente antes de ampliar la suite.                                        |
| 11. Calidad profesional     | CUMPLE  | `package.json`, `vite.config.ts`, suite completa y coverage                                                   | La suite corre en CI, es reproducible, usa herramientas estándar y detecta fallos reales de formularios, permisos, sesión, errores y contratos API.                                                                                           |

**Resumen:** 6 criterios `CUMPLE`, 5 `PARCIAL`, 0 `NO CUMPLE`, 0 `NO APLICA`.

No se marcó ningún apartado como `NO APLICA`: los ejemplos del checklist se mapearon a formularios académicos y tablas reales del producto.

## 5. Hallazgo corregido

`src/tests/unit/api-client.test.ts` accedía directamente a `api.interceptors.request.handlers` y `api.interceptors.response.handlers`. Esas propiedades son detalles internos de Axios y podían permitir que el test pasara aunque el contrato público de `api` estuviera roto.

Corrección aplicada:

- Se usa `api.defaults.adapter`, una extensión pública del cliente Axios.
- Las peticiones se ejecutan sin red.
- Se verifican headers CSRF para mutaciones, exclusión de login y lecturas.
- Se verifica el evento `auth:expired` para una respuesta 401 protegida.
- Se restaura el adapter original después de cada test.

No se modificó la lógica de producción.

## 6. Resultados de ejecución

Ejecutado desde `frontend`:

```text
npm run test:run
16 test files passed
62 tests passed

npm run test:coverage
16 test files passed
62 tests passed

npm run typecheck
passed

npm run lint
passed

npm run build
passed
```

Advertencias no bloqueantes del build:

- Rollup elimina anotaciones de pureza de comentarios dentro de `zod`.
- El bundle JavaScript supera 500 kB minificado.

No hubo pruebas Vitest omitidas ni fallidas.

## 7. Cobertura final

| Métrica    | Resultado |
| ---------- | --------: |
| Statements |   93,23 % |
| Branches   |   85,00 % |
| Functions  |   88,96 % |
| Lines      |   93,63 % |

La cobertura no se interpreta como prueba de ausencia de defectos; se contrastó con los estados y comportamientos observables cubiertos por los tests.

## 8. Archivos modificados por esta auditoría

- `frontend/src/tests/unit/api-client.test.ts`
- `frontend/README_QA.md`

Se conservaron sin revertir cambios previos del trabajo QA, incluidos los ajustes existentes del spec Cypress. No se modificó backend, lógica de negocio, autenticación, CSRF, cookies ni configuración de API.

## 9. Limitaciones y riesgos pendientes

- Vitest no prueba contra FastAPI ni PostgreSQL; esos contratos pertenecen a integración backend y Cypress.
- La suite no cubre todos los errores de red de cada servicio individual.
- No existe un flujo Vitest que pruebe persistencia real; hacerlo aquí introduciría acoplamiento con infraestructura externa.
- Algunos tests largos pueden dividirse en el futuro si el diagnóstico de fallos se vuelve costoso, pero no se consideró necesario para cerrar esta auditoría.
- Las advertencias de tamaño de bundle no afectan la corrección de los tests.

## 10. Uso responsable de IA

La revisión técnica deja estas preguntas para validación del estudiante:

- ¿Podría explicar cada test sin mirar el código? Debe verificarse oralmente, especialmente en `workspace-page.test.tsx` y `services.test.ts`.
- ¿Sé por qué existe cada prueba? La intención está expresada en los nombres, pero debe confirmarse para cada flujo antes de añadir más casos.
- ¿Qué código redundante generó la IA? El acceso directo a internals de Axios era un acoplamiento innecesario y fue eliminado; también hay repetición de fixtures en algunos tests largos.
- ¿Qué pruebas detectan defectos reales? Las de CSRF, expiración de sesión, permisos, formularios inválidos, lookup vacío/error, paginación, mutaciones fallidas y estados de carga tienen comportamiento observable que puede fallar ante regresiones.
- ¿Qué decisiones se revisaron? Se revisaron queries accesibles, aislamiento de mocks, ausencia de red en Vitest, limpieza de mocks, estados asíncronos, contratos de callbacks y ejecución en CI.

## Conclusión

La suite frontend tiene nivel profesional y es ejecutable en CI. Cumple los principios principales de Testing Library, accesibilidad, aislamiento y mocking controlado. La corrección aplicada elimina un acoplamiento real a internals de Axios sin cambiar producción.

El resultado global es **APROBADO CON OBSERVACIONES**: no hay defectos bloqueantes en la suite, pero permanecen brechas moderadas en cobertura sistemática de casos límite y algunos tests demasiado agrupados.
