# Cierre de Fase 2 — Organizacional + Personal + Auth

**Fecha:** 2026-08-04
**Estado:** Fase 2 cerrada. Habilita el arranque de Fase 3 (estructura
académica).

Este documento confirma, con evidencia real (no simulada), los 3 puntos
pendientes que quedaron abiertos al cierre de Fase 2, más el resumen
completo de qué se implementó y qué se validó.

## Punto 1 — Nota en la matriz RBAC sobre `POST /plantel`

`docs/rbac/matriz-rbac-mvp.md`, Nivel 1, nota bajo la tabla (líneas 31-37):
documenta explícitamente que ningún rol tiene `Create` sobre `Plantel`, que
el MVP es de un solo plantel (`docs/data_dictionary/mvp.md` #1), que esa
fila se crea vía seed/migración y no vía API, y que
`app/domains/organizacional/router.py` no expone `POST /plantel` a
propósito — solo `GET`.

## Punto 2 — PUT /periodo-semestral y PUT /personal, con tests de autorización

Ambos endpoints están implementados:

- `PUT /periodo-semestral/{id_periodo}` (`app/domains/organizacional/router.py`):
  activa/desactiva un periodo, restringido a `directivo`/`admin`
  (`require_roles("directivo", "admin")`). El service
  (`set_periodo_semestral_activo`) respeta el índice único parcial que
  garantiza un solo periodo activo a la vez — activar uno nuevo desactiva
  el anterior en la misma llamada.
- `PUT /personal/{id_personal}` (`app/domains/personal/router.py`): edita
  datos y rol, restringido a `admin` (`require_roles("admin")`), tal como
  exige ADR-003 (directivo solo lee `Personal`). El service
  (`update_personal`) implementa además la regla de negocio pendiente de
  `CLAUDE.md`: el único `admin` activo no puede darse de baja ni cambiar su
  propio rol (`LastActiveAdminError`, HTTP 409) — verificado con
  `count_active_admins`, no en RLS ni en constraint de tabla, como
  recomienda `docs/rbac/matriz-rbac-mvp.md`.

**Tests nuevos: 12**, en `tests/test_put_endpoints.py`:

```
test_periodo_semestral_put_docente_forbidden_403
test_periodo_semestral_put_directivo_can_deactivate_200
test_periodo_semestral_put_activating_deactivates_the_other_200
test_periodo_semestral_put_not_found_404
test_personal_put_docente_forbidden_403
test_personal_put_directivo_forbidden_403
test_personal_put_admin_edits_data_and_role_200
test_personal_put_not_found_404
test_personal_put_sole_active_admin_cannot_demote_self_409
test_personal_put_sole_active_admin_cannot_deactivate_self_409
test_personal_put_admin_editing_someone_else_not_blocked_by_guard_200
test_personal_put_admin_can_demote_self_if_another_active_admin_exists_200
```

Los 12 pasan contra Postgres real, no mocks: el fixture `client` de
`tests/conftest.py` sirve el `TestClient` con la app real conectada vía
`DATABASE_URL` (rol `sige_app`, el mismo de runtime) — el seed de datos usa
`DATABASE_URL_MIGRATIONS` (`sige_migrator`) solo para poblar, nunca para
servir requests, siguiendo el mismo patrón que
`docs/validacion/rls-test-log-sige_app.md`.

## Punto 3 — pytest conectado a CI, evidencia real de GitHub Actions

`.github/workflows/ci.yml`, paso "Punto 4 - suite de pytest (RBAC + cadena
JWT -> SET -> RLS)", corre `python -m pytest -v` en cada push/pull request,
después de levantar el stack completo (`db` → `migrate` → `app`) y validar
`/health`.

- Repo: `rxhdf/Sistema-integral-de-gestion-escolar`
- Run: [`30967396658`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/30967396658)
- Commit: `e282134` — "CI: correr pytest (RBAC + cadena JWT -> SET -> RLS) en cada push/PR"
- Job `fase0-gate`: **success**
- Resultado del step de pytest: **39 passed, 1 warning in 54.23s**

Obtenido directamente vía `gh run view 30967396658 --log` contra el repo
remoto, no reconstruido de memoria. El nombre del job (`fase0-gate`) se
dejó igual a propósito para no romper reglas de branch protection que ya
lo referencien — el comentario en el workflow lo aclara.

## Resumen de lo implementado en Fase 2

- **Auth JWT**: `POST /auth/login` (`app/domains/personal/router.py`) valida
  credenciales vía `fn_login_lookup` (SECURITY DEFINER, ADR-007 — resuelve
  el gap de RLS en el login, ver
  `docs/validacion/adr-007-login-lookup-validation.md`) y emite un JWT con
  `id_personal` y `rol`. Cada request autenticado hace `SET` de esas
  variables de sesión en Postgres antes de ejecutar la query, para que RLS
  las use (cadena JWT → SET → RLS, validada en
  `tests/test_login_rls_e2e.py`).
- **Dominio `organizacional`**: modelos/schemas/repository/service/router
  para `Plantel` (solo `GET`), `Ciclo_Escolar` (`GET`/`POST`) y
  `Periodo_Semestral` (`GET`/`POST`/`PUT`).
- **Dominio `personal`**: modelos/schemas/repository/service/router para
  `Personal` (`POST`/`GET`/`GET /me`/`PUT`), con el guard del único admin
  activo en el `PUT`.
- **Tests**: 39 en total —
  `test_auth_rbac.py` (login, RBAC de creación/lectura por rol),
  `test_login_rls_e2e.py` (cadena JWT → SET → RLS contra `fn_login_lookup`
  y `Personal`), `test_put_endpoints.py` (los 12 de este cierre).
- **CI**: pytest corre en cada push/PR contra Postgres real en el runner,
  después del gate de Fase 0 (roles, migración, `/health`).

## Verificación final: suite completa

Corrida una vez más contra Postgres real (`docker-compose up`, local, no
CI) el 2026-08-04:

```
============================= 39 passed, 1 warning in 77.26s ==============================
```

Mismo resultado que en CI (39 passed) — sin discrepancias entre el entorno
local y el runner de GitHub Actions.

## Qué queda fuera de Fase 2 (a propósito, marcado para fases futuras)

- **`Grupo_Asignatura` con 2 docentes por materia/grupo/período**: pregunta
  de negocio sin resolver (`CLAUDE.md`), no bloquea Fase 2 pero sí
  `academico`. Pendiente de validar con plantel piloto.
- **Umbral de aprobado/reprobado en `Calificacion`**: asumido `>=6`, sin
  confirmar — pendiente de `academico`/`control_escolar`.
- **`PUT /plantel`** (actualizar, no crear): la matriz RBAC ya documenta
  que directivo/admin tienen `U` sobre `Plantel`, pero el endpoint todavía
  no existe — no confundir con el `POST /plantel` que sí está bloqueado a
  propósito (ver Punto 1). Queda para cuando haya necesidad real de editar
  los datos del plantel vía API.
- **`promedio_actual` visible al docente para todas las materias, no solo
  la suya**: decisión marcada explícitamente como revisable a futuro en la
  matriz RBAC (Nivel 3) — si se restringe después, es cambio de RLS/schema,
  no de estructura de tabla.
- **`Expediente_Personal`/`Escolar`, `Familia`, `Tutor`, `Asistencia`**:
  fuera de alcance del MVP por ADR-002, no específico de Fase 2.

## Conclusión

Los 3 puntos pendientes están confirmados con evidencia real: la nota de
`POST /plantel` ya está escrita en la matriz RBAC, los dos `PUT` están
implementados con 12 tests nuevos de autorización pasando contra Postgres
real, y CI corre los 39 tests en verde en GitHub Actions contra el
repositorio remoto (run `30967396658`). **Fase 2 formalmente cerrada** —
Fase 3 (estructura académica) puede arrancar.
