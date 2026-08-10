# Dashboard — gap de RLS en las vistas agregadas, encontrado y corregido

**Fecha:** 2026-08-08
**Contexto:** con las 5 fases del MVP cerradas, se construyó
`app/domains/dashboard/` (`GET /dashboard/resumen`) sobre las dos vistas
calculadas que ya existían en `db/ddl_mvp.sql` desde el esquema inicial
(`7460fa835be8`): `vw_grupo_num_alumnos` y `vw_plantel_matricula_total`.
Antes de continuar con el frontend, se corrigió un gap de seguridad en
esas vistas — mismo rigor y mismo patrón que el gap de
`expediente_academico_select` en Fase 4
(`docs/validacion/fase-04-alumnos.md`).

## Punto 1 — El gap

Ambas vistas se crearon con `CREATE OR REPLACE VIEW ... AS SELECT ...`,
sin `security_invoker`. En Postgres, el comportamiento por defecto
(`security_invoker = false`) evalúa permisos **y políticas RLS** con el
owner de la vista, no con quien la consulta. Las dos vistas las creó
`sige_migrator` (vía Alembic) — el mismo rol que es *owner* de `alumno`.
Un owner de tabla bypassea RLS por defecto (sin `FORCE ROW LEVEL
SECURITY`), así que el `LEFT JOIN alumno` de ambas vistas **ignoraba
`alumno_select` sin importar qué rol hiciera la consulta**: una sesión
`sige_app` con `app.current_rol = 'docente'` obtenía el conteo real de
alumnos de TODO el plantel, no acotado a los grupos donde ese docente
tiene `grupo_asignatura` activa.

`app/domains/dashboard/service.py` solo expone `matricula_total` (vía
`vw_plantel_matricula_total`) a `directivo`/`admin` — un docente nunca la
recibe por ese endpoint. Pero, igual que en Fase 4, **eso protegía un
único code path, no la vista**: una consulta directa (`SELECT * FROM
vw_plantel_matricula_total` o `vw_grupo_num_alumnos`) desde una sesión de
docente veía el dato real sin restricción, algo que un futuro endpoint,
script, o agente que reutilizara la vista sin conocer este matiz
heredaría en silencio.

`plantel` y `grupo` (las tablas "ancla" de ambas vistas) siguen sin RLS
por fila **a propósito** — decisión ya tomada y documentada al final de
`db/ddl_mvp.sql` (MVP de un solo plantel, bajo riesgo, revisable al
expandir a más de un plantel). El gap no estaba ahí: estaba en que el
`LEFT JOIN alumno` —que sí tiene `alumno_select` ya validado desde Fase
4— no se respetaba por el efecto de owner. `security_invoker = true`
basta para que la vista herede `alumno_select` tal cual; **no hizo falta
agregar RLS nuevo a `plantel` ni `grupo`** — la ausencia de RLS en esas
dos tablas sigue siendo la decisión ya tomada, no una laguna nueva.

## Punto 2 — Corrección

`db/ddl_mvp.sql`: ambas vistas ahora se declaran con `WITH
(security_invoker = true)`. Migración Alembic
`efa3c08ba776_vw_dashboard_security_invoker.py` (encadenada después de
`3698a658047c`) aplica `ALTER VIEW ... SET (security_invoker = true)` a
las dos vistas ya existentes, sin reescribir la migración inicial.

Confirmado en Postgres real tras `alembic upgrade head`:

```sql
          relname           |       reloptions        
----------------------------+-------------------------
 vw_grupo_num_alumnos       | {security_invoker=true}
 vw_plantel_matricula_total | {security_invoker=true}
```

## Punto 3 — Test de bypass directo (antes/después, evidencia real)

`tests/test_dashboard.py`, mismo patrón que
`test_expediente_direct_query_docente_out_of_scope_blocked_by_rls`
(Fase 4): autentica un docente, fija la sesión de Postgres igual que
`get_current_personal` (`_set_session`), y consulta las vistas **crudas**,
sin pasar por `service.get_resumen` / `repository.matricula_total`.

- `test_vw_grupo_num_alumnos_direct_query_docente_out_of_scope_blocked_by_rls`:
  docente 1 consulta `vw_grupo_num_alumnos` para el grupo del docente 2
  (1 alumno real, ajeno a docente 1).
- `test_vw_plantel_matricula_total_direct_query_docente_scoped_by_rls`:
  docente 1 consulta `vw_plantel_matricula_total` con 2 alumnos activos
  en el plantel (1 propio, 1 del docente 2).

**Antes de la corrección** (`security_invoker` ausente), ejecutados contra
Postgres real:

```
FAILED test_vw_grupo_num_alumnos_direct_query_docente_out_of_scope_blocked_by_rls
  AssertionError: RLS debió bloquear el conteo de alumnos de un grupo ajeno al docente
  assert 1 == 0   # vio el conteo real del grupo ajeno, no 0

FAILED test_vw_plantel_matricula_total_direct_query_docente_scoped_by_rls
  AssertionError: RLS debió acotar matricula_total al scope del docente, no al plantel completo
  assert 2 == 1   # vio la matrícula total del plantel completo, no solo la suya
```

**Después de la corrección** (migración `efa3c08ba776` aplicada):

```
tests/test_dashboard.py::test_vw_grupo_num_alumnos_direct_query_docente_out_of_scope_blocked_by_rls PASSED
tests/test_dashboard.py::test_vw_plantel_matricula_total_direct_query_docente_scoped_by_rls PASSED
```

## Punto 4 — Verificación completa

Suite completa contra Postgres real, local (`docker-compose up --build` —
necesario porque la imagen `migrate` estaba cacheada sin la migración
nueva, mismo motivo que en Fase 4):

- Antes de tocar código: **149 passed** (baseline, confirma el número ya
  reportado en `CLAUDE.md`).
- Con los 2 tests de bypass agregados mas la corrección aplicada:
  **151 passed** (149 previos + 2 nuevos de bypass RLS).

## Conclusión

Gap de RLS en `vw_grupo_num_alumnos` / `vw_plantel_matricula_total`
corregido con `security_invoker = true` (Postgres 15+), sin necesidad de
agregar RLS a `plantel`/`grupo` — esa ausencia sigue siendo la decisión ya
documentada en `db/ddl_mvp.sql`, no una laguna. 151 tests pasando contra
Postgres real, incluyendo 2 nuevos de bypass directo (antes/después con
evidencia real, no simulada). `GET /dashboard/resumen` no cambió de
comportamiento para ningún rol vía la API — el gap solo era alcanzable
con una consulta directa a las vistas.
