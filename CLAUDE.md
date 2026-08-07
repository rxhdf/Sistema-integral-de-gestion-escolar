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

**Fase 4 (Alumnos y Expedientes: `Alumno`, `Expediente_Academico`)
cerrada y confirmada.** Evidencia real: 95 tests pasando (68 previos + 27
nuevos, incluyendo 2 de bypass directo de RLS) en Postgres real, local
(`docker-compose up --build`) — ver `docs/validacion/fase-04-alumnos.md`
para el detalle completo, incluyendo un gap de RLS encontrado y
corregido en `expediente_academico_select` (tenía `USING(true)`,
contradecía ADR-001). CI de GitHub Actions sigue pendiente de
confirmación por la falla de dispatch documentada en
`docs/validacion/ci-dispatch-outage-2026-08-06.md` — no bloqueante.

**Fase 5 (control escolar: `Calificacion`, `Auditoria_Calificacion`)
cerrada y confirmada.** Evidencia real: 114 tests pasando (95 previos +
19 nuevos) en Postgres real, local (`docker-compose up --build`) — ver
`docs/validacion/fase-05-control-escolar.md` para el detalle completo,
incluyendo **3 gaps de RLS** encontrados y corregidos antes/durante la
implementación (uno de diseño, `auditoria_calificacion_insert` con
`WITH CHECK(true)`; dos que solo aparecieron al ejercer el flujo real
como docente: `RETURNING` vs. política SELECT de auditoría, y
`promedio_actual` bloqueado por `expediente_academico_write` — resuelto
con `fn_actualizar_promedio_actual`, SECURITY DEFINER acotada a una sola
columna derivada, mismo patrón que ADR-007). CI de GitHub Actions sigue
pendiente por la falla de dispatch ya documentada — no bloqueante.

**Con Fase 5 cerrada, todas las entidades del MVP (ADR-002) están
implementadas** (`Plantel`, `Ciclo_Escolar`, `Periodo_Semestral`,
`Personal`, `Grupo`, `Asignatura`, `Grupo_Asignatura`, `Alumno`,
`Expediente_Academico`, `Calificacion`, `Auditoria_Calificacion`). No hay
una "Fase 6" planeada todavía — el siguiente paso es decisión del
usuario: cerrar pendientes sueltos (ver abajo) o pasar a otra capa
(frontend, deploy, etc.).

## Qué leer para qué (no releer todo por defecto)

| Necesito... | Leer |
|---|---|
| Entidades, tipos de campo, nulabilidad, sensibilidad de datos | `docs/data_dictionary/mvp.md` |
| Quién puede hacer qué (CRUD por rol, scope, campos ocultos) | `docs/rbac/matriz-rbac-mvp.md` |
| Por qué el esquema/roles/RLS son como son — **leer antes de proponer cambios de arquitectura** | `docs/decisions/ADR-001.md` a `ADR-007.md` (ver resumen abajo) |
| El DDL real, ya validado en Postgres 16 (tablas, RLS, funciones helper) | `db/ddl_mvp.sql` |
| Cómo se traduce ese DDL a Alembic | `app/db/migrations/versions/7460fa835be8_initial_schema_from_ddl_mvp.py` |
| Cómo levantar todo local (roles, migración automática, /health) | `docker-compose.yml` + `docs/decisions/ADR-006.md` |
| Evidencia de que RLS funciona con el rol real de runtime | `docs/validacion/rls-test-log-sige_app.md` |
| Cierre y evidencia del gate de Fase 0 | `docs/validacion/fase-0-cierre.md` |
| Cierre y evidencia de Fase 2 (organizacional/personal/Auth) | `docs/validacion/fase-02-organizacional-personal-auth.md` |
| Cierre y evidencia de Fase 3 (académico: Grupo/Asignatura/Grupo_Asignatura) | `docs/validacion/fase-03-academico.md` |
| Cierre y evidencia de Fase 4 (Alumno/Expediente_Academico) + gap de RLS corregido | `docs/validacion/fase-04-alumnos.md` |
| Cierre y evidencia de Fase 5 (Calificacion/Auditoria_Calificacion) + 3 gaps de RLS corregidos | `docs/validacion/fase-05-control-escolar.md` |
| Falla de dispatch de GitHub Actions (commits sin CI confirmado) | `docs/validacion/ci-dispatch-outage-2026-08-06.md` |

### Resumen de 1 línea por ADR (no sustituye leerlos completos)

- **ADR-001**: `Expediente_Academico` es tabla separada de `Alumno` — permite RLS por tabla completa, no por columna.
- **ADR-002**: MVP limitado a `Expediente_Academico`; `Expediente_Personal`/`Escolar`, `Familia`, `Tutor`, `Asistencia`, etc. quedan fuera a propósito.
- **ADR-003**: roles colapsados en `Personal.rol` (`docente`/`directivo`/`admin`), no tablas separadas por rol.
- **ADR-004**: `directivo`/`admin` sí pueden corregir calificaciones ya capturadas por un docente (auditoría debe distinguir captura vs. corrección).
- **ADR-005**: `calificacion_final` y `promedio_actual` se calculan en el service de FastAPI, no en trigger ni vista de Postgres.
- **ADR-006**: separación de roles de conexión a Postgres (ver siguiente sección) — el más relevante para cualquier trabajo de infraestructura/backend.
- **ADR-007**: `fn_login_lookup` (`SECURITY DEFINER`) — excepción acotada a RLS de `Personal` para resolver el login, ya que antes de emitir el JWT no hay `SET app.current_rol`/`app.current_personal_id` que RLS pueda usar.

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

- 135 tests pasando localmente contra Postgres real (ver
  `docs/validacion/fase-05-control-escolar.md` para el desglose); CI de
  GitHub Actions pendiente de confirmación por causa externa (ver
  `docs/validacion/ci-dispatch-outage-2026-08-06.md`), no por falla del
  código.
- `POST /calificacion` con `id_grupo_asig` ajeno ahora devuelve `403`
  limpio (`GrupoAsignaturaAjenoError`), no un `500` sin traducir.
  `PUT /calificacion/{id}` se mantiene en `404` (no `403`) para un
  docente atacando la calificación de otro — decisión explícita,
  consistente con la opacidad RLS ya usada en `alumno`.
- `auditoria_calificacion` confirmado append-only con el mismo rigor de
  Fase 4: sin endpoint `PUT`/`DELETE` (405), sin política RLS de
  `UPDATE`/`DELETE` (Postgres deniega por defecto — `0` filas afectadas,
  para cualquier rol, incluido `admin`, que no es superusuario/owner).
- Preguntas de negocio sin resolver: si `Grupo_Asignatura` admite 2
  docentes por materia/grupo/período (validar con plantel piloto — el
  `UNIQUE` actual en `db/ddl_mvp.sql` asume uno solo), y el umbral real de
  aprobado/reprobado en `Calificacion` (asumido `>=6`,
  `app/domains/control_escolar/service.py::UMBRAL_APROBADO`, sin
  confirmar con el negocio — ver `docs/data_dictionary/mvp.md` #3).
- Regla de "faltantes" en `calificacion_final` (ADR-005 la dejaba
  abierta): se promedia sobre los parciales **disponibles**, no exige
  los 3 — solo queda `NULL`/`pendiente` si ninguno se ha capturado.
  Revisable si el negocio prefiere exigir los 3 antes de dar un
  resultado.
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
