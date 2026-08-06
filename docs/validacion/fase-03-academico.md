# Cierre de Fase 3 — Estructura Académica

**Fecha:** 2026-08-06
**Estado:** Fase 3 cerrada. Habilita el arranque de Fase 4.

Este documento confirma, con evidencia real (no simulada), el cierre de
Fase 3 (dominio `academico`: `Grupo`, `Asignatura`, `Grupo_Asignatura`),
siguiendo el mismo formato de `docs/validacion/fase-02-organizacional-personal-auth.md`.

## Punto 1 — Qué se implementó

Dominio `app/domains/academico/` completo, siguiendo el patrón de
auth/RLS ya establecido en Fase 2 (`get_current_personal`, `require_roles`):

- **`Grupo`**: `GET` abierto a los 3 roles; `POST`/`PUT` restringido a
  `directivo`/`admin` (matriz RBAC, Nivel 1).
- **`Asignatura`**: mismo patrón que `Grupo` — `GET` abierto, `POST`/`PUT`
  restringido a `directivo`/`admin`.
- **`Grupo_Asignatura`**: `GET` con scope por rol vía RLS (`docente` solo
  ve las suyas, `WHERE id_docente = current_user_id` — política
  `grupo_asignatura_select` en `db/ddl_mvp.sql`); `POST`/`PUT` restringido
  a `directivo`/`admin`.
- **`DocenteInvalidoError`** (`app/domains/academico/service.py`):
  traduce el `InternalError` crudo de Postgres que dispara el trigger
  `fn_valida_rol_docente` (`db/ddl_mvp.sql` — valida que `id_docente`
  referencie a un `Personal` con `rol = 'docente'`) a un `400` claro en el
  router, en vez de propagar un 500.

## Punto 2 — Tests: 29 nuevos, uno por celda de la matriz RBAC

`tests/test_academico.py`, uno por cada combinación rol × entidad ×
operación de `docs/rbac/matriz-rbac-mvp.md` para `Grupo`, `Asignatura` y
`Grupo_Asignatura`, incluyendo:

- Los 3 `GET` (uno por rol) × 3 entidades.
- `POST`/`PUT` forbidden (403) para `docente`, permitido (201/200) para
  `directivo`/`admin`, en las 3 entidades.
- `PUT` sobre id inexistente → 404, en las 3 entidades.
- Scope de `docente` en `Grupo_Asignatura`: `test_grupo_asignatura_scope_docente_sees_only_own_200`
  — confirma que RLS filtra correctamente por `id_docente`, no solo que el
  endpoint responde 200.
- `test_grupo_asignatura_create_id_docente_not_docente_role_400` — confirma
  que `DocenteInvalidoError` se dispara y se traduce a 400 cuando
  `id_docente` no tiene `rol = 'docente'`.

## Punto 3 — Suite completa: 68 passed (39 previos + 29 nuevos)

Corrida contra Postgres real, dos veces, mismo resultado:

**Local** (`docker-compose up`, host, 2026-08-06):

```
============================= 68 passed, 1 warning in 130.97s (0:02:10) ===================
```

**CI** (GitHub Actions, `rxhdf/Sistema-integral-de-gestion-escolar`):

- Run: [`31127657254`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/31127657254)
- Commit: `50cd272` — "Fase 3: estructura académica (Grupo, Asignatura, Grupo_Asignatura)"
- Job `fase0-gate`: **success**
- Resultado del step de pytest: **68 passed, 1 warning in 97.08s**

Obtenido vía `gh run view 31127657254 --log` contra el repo remoto. La
sospecha inicial de un outage de GitHub al momento de arrancar este cierre
no se confirmó — `gh auth status` y la API respondieron con normalidad, y
el run de CI para el commit de Fase 3 ya existía en verde.

Mismo resultado en ambos entornos (68 passed) — sin discrepancias entre
local y CI, igual que en el cierre de Fase 2.

## Qué queda fuera de Fase 3 (a propósito, marcado para fases futuras)

- **`Grupo_Asignatura` con 2 docentes por materia/grupo/período**: sigue
  sin resolverse (pregunta de negocio de `CLAUDE.md`, pendiente de validar
  con plantel piloto). El schema actual (`uq_grupo_asignatura_periodo`,
  `db/ddl_mvp.sql` líneas 108-118) asume un solo docente por
  grupo+asignatura+periodo; si la respuesta es "sí admite 2", el cambio es
  ampliar ese `UNIQUE` para incluir `id_docente`, no reestructurar la
  tabla. Comentario explícito ya dejado en el DDL.
- **`Calificacion`, umbral de aprobado/reprobado**: fuera de alcance de
  Fase 3 (que solo cubrió `Grupo`/`Asignatura`/`Grupo_Asignatura`, no
  `Calificacion`). Sigue asumido `>=6`, sin confirmar — pendiente de
  Fase 4 (`control_escolar`).
- **`Expediente_Personal`/`Escolar`, `Familia`, `Tutor`, `Asistencia`**:
  fuera de alcance del MVP por ADR-002, no específico de Fase 3.

## Conclusión

Dominio `academico` implementado siguiendo el patrón de Fase 2, 29 tests
nuevos de autorización pasando contra Postgres real (68 en total), y CI
verde en GitHub Actions para el commit de cierre (run `31127657254`).
**Fase 3 formalmente cerrada** — Fase 4 puede arrancar.
