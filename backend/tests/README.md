# Estrategia de pruebas

La suite sigue la pirámide de testing:

| Capa        | Carpeta                                   | Propósito                                      | Dependencias                |
| ----------- | ----------------------------------------- | ---------------------------------------------- | --------------------------- |
| Unit        | `tests/unit/`                             | Reglas puras, esquemas, seguridad y edge cases | Ninguna; usa mocks          |
| Integration | `tests/integration/`                      | Servicios, ORM, API y serialización            | SQLite en memoria por test  |
| E2E         | `tests/e2e/`                              | Flujo de usuario por HTTP                      | FastAPI TestClient y SQLite |
| PostgreSQL  | `tests/test_user_profile_postgres_e2e.py` | Compatibilidad con la base configurada         | PostgreSQL real; opt-in     |

## Convenciones

- Cada prueba usa Arrange, Act, Assert y tiene un nombre que describe el comportamiento.
- Las fixtures con `scope=function` mantienen aislamiento. `sqlite_engine` usa `scope=session` solo para reutilizar la conexión en memoria; el esquema se crea y destruye por función.
- No se comparten entidades mutables entre pruebas. `tests/factories/` crea datos deterministas, y `tests/data/` queda para contratos estáticos pequeños.
- `monkeypatch` y `unittest.mock.patch` se reservan para controlar reloj, configuración o colaboradores externos; las pruebas de integración no simulan la base de datos.
- Los markers disponibles son `unit`, `integration`, `e2e` y `postgres_e2e`.

## Ejecución local

```powershell
cd backend
python -m pip install -r requirements.txt -r requirements-test.txt
python -m pytest
python -m pytest -m unit
python -m pytest -m integration
python -m pytest -m e2e
python -m pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=85
```

El E2E PostgreSQL existente solo se ejecuta con `RUN_POSTGRES_E2E=1` y una base configurada. La suite normal nunca modifica esa base.

## Cobertura y alcance

El objetivo de CI es como mínimo 85% de cobertura de `app`. Se cubren reglas de validación, autenticación, permisos, CSRF, persistencia, límites académicos, cálculo ponderado y contratos HTTP. No se cuenta como cobertura de negocio el código generado por migraciones, arranque de infraestructura o integraciones externas que no existen todavía.

El repositorio actual no implementa pagos, reportes, certificados ni un endpoint público de registro. Por eso no se inventan pruebas para esos flujos: deben añadirse junto con sus módulos y contratos. El flujo de alta disponible se prueba mediante la factory/servicio de usuarios y luego se valida login, matrícula y calificación por las capas correspondientes.

## Datos y seguridad

Las factories usan valores reproducibles y no contienen secretos reales. Las contraseñas de prueba son locales, los JWT se guardan en cookies y las respuestas verifican que `password_hash` no se serializa. Nunca se deben añadir dumps de producción, tokens o datos personales reales a `tests/data/`.
