# Seed de desarrollo — credenciales

> **SOLO DESARROLLO — nunca usar en producción.** Estas credenciales son
> obviamente falsas a propósito (dominio `cobao.edu.mx` de ejemplo,
> contraseñas de patrón predecible) para que nadie las confunda con datos
> reales. `db/seed_dev.py` las crea vía `hash_password` (mismo bcrypt que
> usa el login real, ver `app/core/security.py`) — no hay hash a mano en
> SQL.

## Credenciales

| Rol | Email | Password |
|---|---|---|
| `docente` | `docente@cobao.edu.mx` | `Docente123!` |
| `directivo` | `directivo@cobao.edu.mx` | `Directivo123!` |
| `admin` | `admin@cobao.edu.mx` | `Admin123!` |

## Qué más siembra

Para que el docente de prueba tenga datos reales en su dashboard y no
ceros vacíos:

- 1 `Plantel` (`PL-DEV`), 1 `Ciclo_Escolar` y 1 `Periodo_Semestral`
  activos (`2026-2027-DEV` / `2026A-DEV`).
- 1 `Grupo` (`1A-DEV`), 1 `Asignatura` (`MAT-DEV`), y su
  `Grupo_Asignatura` asignada al docente de prueba.
- 2 `Alumno` (`SEED-ALU-0001`, `SEED-ALU-0002`) inscritos en `1A-DEV`, cada
  uno con su `Expediente_Academico`.

## Cómo correrlo

Requiere el stack levantado (`docker-compose up -d db` como mínimo, con
`alembic upgrade head` ya aplicado — ver README). Desde el host, con el
mismo patrón de variables de entorno que usa la suite de tests
(`db:5432` del `.env` se sobreescribe a `localhost:5432` porque el script
corre fuera de la red de docker-compose):

```bash
export DATABASE_URL_MIGRATIONS=postgresql://sige_migrator:<tu_DB_MIGRATOR_PASSWORD>@localhost:5432/sige
export DATABASE_URL=postgresql://sige_app:<tu_DB_APP_PASSWORD>@localhost:5432/sige
export JWT_SECRET_KEY=<cualquier_valor_de_dev>
python3 db/seed_dev.py
```

(Usa los mismos `DB_MIGRATOR_PASSWORD`/`DB_APP_PASSWORD` que tu `.env`
local — son los mismos `DB_MIGRATOR_USER`/`DB_MIGRATOR_PASSWORD`/
`DB_APP_USER`/`DB_APP_PASSWORD` que usa `docker-compose.yml`.
`JWT_SECRET_KEY` hace falta aunque el script no emite tokens: importa
`app.core.security` para reusar `hash_password`, que a su vez importa
`app.core.config`, que exige esa variable al cargar — cualquier valor de
dev sirve, usa el mismo que `.env`.)

El script corre como `sige_migrator` (owner, bypassea RLS) — igual que
`tests/conftest.py` — porque antes de que exista una sesión autenticada,
RLS de `personal`/`alumno`/etc. no tiene con qué evaluar el rol y
deniega el INSERT (ADR-006).

**Reproducible / idempotente:** cada INSERT usa `ON CONFLICT ... DO
NOTHING` sobre la misma restricción `UNIQUE` real de `db/ddl_mvp.sql`, así
que correrlo dos veces no duplica filas ni truena. Seguro de repetir cada
vez que reinicies el stack con un volumen limpio (`docker-compose down -v
&& docker-compose up -d db && docker-compose up migrate && python3
db/seed_dev.py`), y también seguro de correr sobre un stack que ya tenía
este mismo seed aplicado.

**Nota:** `pytest` (`tests/conftest.py::seed`) hace `TRUNCATE ...
CASCADE` de `personal`/`plantel`/`ciclo_escolar`/etc. al arrancar cada
test — si corres la suite de tests contra la misma base de datos donde
sembraste estos usuarios de desarrollo, los borra. Vuelve a correr
`python3 db/seed_dev.py` después de correr tests si quieres los usuarios
de desarrollo de vuelta.

## Probar varios roles a la vez en el frontend

`localStorage` se comparte entre pestañas del mismo origen — loguearte
con un rol distinto en otra pestaña sobrescribe el token de la sesión
activa en todas las demás. Para tener docente/directivo/admin logueados
al mismo tiempo (o simplemente evitar que una pestaña te pise la sesión
de otra), usa ventanas de incógnito separadas o perfiles de navegador
distintos, uno por rol.

## Verificación real (no simulada)

Confirmado contra el backend real (`docker-compose up -d app`), los 3
logins devuelven `200` con un JWT válido:

```bash
curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email_institucional":"docente@cobao.edu.mx","password":"Docente123!"}'
# → 200, {"access_token": "...", "token_type": "bearer"}
```

Y el dashboard del docente de prueba ya muestra datos reales, no ceros:

```bash
curl -s http://localhost:8000/dashboard/resumen -H "Authorization: Bearer <token>"
# → {"numero_grupos_asignados":1,"numero_alumnos_bajo_responsabilidad":2,"calificaciones_pendientes":2}
```
