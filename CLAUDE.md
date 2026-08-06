# SIGE — estado del proyecto

Orientación rápida para retomar sin releer todo `docs/` ni todo el código.
Este archivo es un índice + reglas, no una fuente de verdad — si algo aquí
contradice el código o un ADR, gana el ADR/código y hay que corregir esto.

## Fase actual

**Fase 0 (fundación) cerrada y confirmada.** Evidencia real, no simulada:
run verde en GitHub Actions (`fase0-gate`, repo
`rxhdf/Sistema-integral-de-gestion-escolar`, commit `27e2668` / `8f1e3e9`
en `main`) — ver `docs/validacion/fase-0-cierre.md` para el detalle
completo (los 4 puntos del gate con logs reales).

**Fase 2 (organizacional + personal + Auth JWT) cerrada y confirmada.**
Evidencia real: 39 tests pasando (RBAC + cadena JWT → SET → RLS) en
Postgres real, run verde en GitHub Actions (`fase0-gate`, commit
`e282134`, run `30967396658`) — ver
`docs/validacion/fase-02-organizacional-personal-auth.md` para el detalle
completo.

**Fase 3 (estructura académica: `Grupo`, `Asignatura`, `Grupo_Asignatura`)
cerrada y confirmada.** Evidencia real: 68 tests pasando (39 previos + 29
nuevos) en Postgres real, run verde en GitHub Actions (`fase0-gate`,
commit `50cd272`, run `31127657254`) — ver
`docs/validacion/fase-03-academico.md` para el detalle completo.

**Próximo paso: Fase 4** — control escolar (`Calificacion`, etc.). Antes
de arrancar, revisar las preguntas de negocio sin resolver en "Pendientes
abiertos" abajo (2 docentes por `Grupo_Asignatura`, umbral de
aprobado/reprobado).

## Qué leer para qué (no releer todo por defecto)

| Necesito... | Leer |
|---|---|
| Entidades, tipos de campo, nulabilidad, sensibilidad de datos | `docs/data_dictionary/mvp.md` |
| Quién puede hacer qué (CRUD por rol, scope, campos ocultos) | `docs/rbac/matriz-rbac-mvp.md` |
| Por qué el esquema/roles/RLS son como son — **leer antes de proponer cambios de arquitectura** | `docs/decisions/ADR-001.md` a `ADR-006.md` (ver resumen abajo) |
| El DDL real, ya validado en Postgres 16 (tablas, RLS, funciones helper) | `db/ddl_mvp.sql` |
| Cómo se traduce ese DDL a Alembic | `app/db/migrations/versions/7460fa835be8_initial_schema_from_ddl_mvp.py` |
| Cómo levantar todo local (roles, migración automática, /health) | `docker-compose.yml` + `docs/decisions/ADR-006.md` |
| Evidencia de que RLS funciona con el rol real de runtime | `docs/validacion/rls-test-log-sige_app.md` |
| Cierre y evidencia del gate de Fase 0 | `docs/validacion/fase-0-cierre.md` |
| Cierre y evidencia de Fase 2 (organizacional/personal/Auth) | `docs/validacion/fase-02-organizacional-personal-auth.md` |
| Cierre y evidencia de Fase 3 (académico: Grupo/Asignatura/Grupo_Asignatura) | `docs/validacion/fase-03-academico.md` |

### Resumen de 1 línea por ADR (no sustituye leerlos completos)

- **ADR-001**: `Expediente_Academico` es tabla separada de `Alumno` — permite RLS por tabla completa, no por columna.
- **ADR-002**: MVP limitado a `Expediente_Academico`; `Expediente_Personal`/`Escolar`, `Familia`, `Tutor`, `Asistencia`, etc. quedan fuera a propósito.
- **ADR-003**: roles colapsados en `Personal.rol` (`docente`/`directivo`/`admin`), no tablas separadas por rol.
- **ADR-004**: `directivo`/`admin` sí pueden corregir calificaciones ya capturadas por un docente (auditoría debe distinguir captura vs. corrección).
- **ADR-005**: `calificacion_final` y `promedio_actual` se calculan en el service de FastAPI, no en trigger ni vista de Postgres.
- **ADR-006**: separación de roles de conexión a Postgres (ver siguiente sección) — el más relevante para cualquier trabajo de infraestructura/backend.

## Roles de conexión a Postgres (ADR-006) — regla dura

Dos roles, nunca intercambiables:

- **`sige_migrator`**: owner de las tablas. Solo lo usa Alembic
  (`DATABASE_URL_MIGRATIONS`). Creado automáticamente por el entrypoint de
  Postgres vía `POSTGRES_USER` en `docker-compose.yml`.
- **`sige_app`**: rol de runtime. `NOSUPERUSER`, sin ownership, solo
  `SELECT/INSERT/UPDATE/DELETE` vía GRANT explícito (otorgado en la
  migración de Alembic + `ALTER DEFAULT PRIVILEGES` en
  `db/init/01_create_app_role.sh`). Es el **único** rol que debe usar
  `DATABASE_URL` en el backend (`app/core/config.py`).

**El backend en runtime NUNCA debe conectarse con `sige_migrator`.** Si lo
hace, RLS se bypassea en silencio (owner/superuser ignoran las políticas
RLS sin error) — ya se validó y documentó este comportamiento en
`docs/validacion/`. Cualquier script, endpoint, o servicio nuevo que
necesite tocar la BD usa `DATABASE_URL` (`sige_app`), nunca
`DATABASE_URL_MIGRATIONS`.

## Pendientes abiertos ahora mismo

- Ninguno bloqueando el arranque de Fase 4 — CI verde confirmado (68
  tests), repo local sincronizado con `origin/main`.
- Preguntas de negocio sin resolver, no bloquean Fase 4 pero sí
  `control_escolar` específicamente: si `Grupo_Asignatura` admite 2
  docentes por materia/grupo/período (validar con plantel piloto — el
  `UNIQUE` actual en `db/ddl_mvp.sql` asume uno solo), y el umbral real de
  aprobado/reprobado en `Calificacion` (asumido `>=6`, sin confirmar).
- `PUT /plantel` (actualizar datos del plantel) no tiene endpoint todavía
  — la matriz RBAC ya otorga `U` a directivo/admin, pero no hay necesidad
  real de editarlo vía API todavía. No confundir con `POST /plantel`, que
  está bloqueado a propósito (ver nota en `docs/rbac/matriz-rbac-mvp.md`).

## Regla explícita para cualquier cambio de esquema

Antes de generar cualquier tabla, política RLS, o cambio de esquema
nuevo: **consultar los ADRs existentes primero.** No duplicar una decisión
ya tomada (ej. no reinventar cómo se resuelve el rol de sesión — ya existen
`app_current_rol()` / `app_current_personal_id()` en `db/ddl_mvp.sql`) ni
contradecir un ADR sin señalarlo explícitamente y proponer uno nuevo que lo
reemplace. Un cambio de arquitectura que contradice un ADR sin decirlo es
un bug de proceso, no solo de código.
