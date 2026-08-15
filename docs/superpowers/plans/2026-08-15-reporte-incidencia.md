# Reporte de Incidencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Reporte_Incidencia` — a docente-authored, plantel-wide, append-only incident report on any alumno — with backend (DDL/RLS/migration/FastAPI/tests) and frontend (capture page for docente, read-only section in Perfil de Análisis for directivo/admin).

**Architecture:** New `reporte_incidencia` table with 2 RLS policies (SELECT scoped by author for docente / full plantel for directivo-admin, INSERT restricted to active docente with no `grupo_asignatura` join — the deliberate scope break, see ADR-010) and no UPDATE/DELETE policies at all (immutable, same rigor as `Auditoria_Calificacion`). A second, narrower deviation: since a docente's normal `Alumno` read scope is limited to their own `grupo_asignatura`, this feature needs a plantel-wide alumno search for docente — done via a new `SECURITY DEFINER` SQL function (`fn_alumno_buscar_docente`, same acotado pattern as `fn_login_lookup`/ADR-007) and a dedicated `GET /alumno/buscar-plantel` endpoint, not by widening `alumno_select`. RLS is validated directly with `sige_app` (never `sige_migrator`) before any FastAPI code is written, matching this project's established rigor (ADR-006/007/008).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 ORM (`Mapped`/`mapped_column`), Alembic, Postgres 16 (RLS), Pydantic v2, React + TypeScript + Vite (frontend), pytest + `TestClient` against a real Postgres via `docker-compose`.

**Spec:** `docs/data_dictionary/reporte-incidencia.md` (data dictionary, just closed this session) and `docs/decisions/ADR-010.md` (architecture deviation rationale, just closed this session). Both already written and should be treated as final — do not re-derive fields or RLS shape, just implement what they say.

## Global Constraints

- Runtime backend connects only via `sige_app` (`DATABASE_URL`) — never `sige_migrator` (`DATABASE_URL_MIGRATIONS`). Migrations use `sige_migrator`. (ADR-006, hard rule in `CLAUDE.md`.)
- No `UPDATE`/`DELETE` RLS policies and no `PUT`/`DELETE` endpoints for `reporte_incidencia` — immutability is enforced at the RLS layer, not just by omitting routes.
- `id_personal_reporta` is never accepted from the request payload — always set server-side from `CurrentPersonal.id_personal`, mirroring `Asistencia`'s `id_personal_registro`.
- RLS for the new table and the new `SECURITY DEFINER` function must be validated directly against Postgres with `psql -U sige_app` (not `sige_migrator`, which bypasses RLS as owner) **before** writing any FastAPI code — same order of operations as ADR-008/Asistencia.
- `db/ddl_mvp.sql` is the readable source-of-truth DDL and must be updated in the same commit as the Alembic migration (never left to drift, per existing convention for every past migration).
- Follow existing file/module conventions exactly: one domain package per bounded concept (`app/domains/reportes/` for the new table; the alumno-search addition lives in the existing `app/domains/alumnos/` package since it reads `Alumno`).

---

## File Structure

**Backend — new:**
- `app/db/migrations/versions/<hash>_reporte_incidencia_table_and_rls.py` — table, 2 indexes, RLS enable + 2 policies, `fn_alumno_buscar_docente` function + grants.
- `app/domains/reportes/__init__.py` — empty, mirrors `app/domains/asistencia/__init__.py`.
- `app/domains/reportes/models.py` — `ReporteIncidencia` SQLAlchemy model.
- `app/domains/reportes/schemas.py` — `ReporteIncidenciaCreate`, `ReporteIncidenciaOut`.
- `app/domains/reportes/repository.py` — `list_reporte_incidencia`, `create_reporte_incidencia`.
- `app/domains/reportes/service.py` — `DocenteInactivoError`, `create_reporte_incidencia`, `list_reporte_incidencia`.
- `app/domains/reportes/router.py` — `POST /reporte-incidencia`, `GET /reporte-incidencia`.
- `tests/test_reporte_incidencia.py` — authorization + scope + immutability tests against real Postgres.

**Backend — modified:**
- `db/ddl_mvp.sql` — append `reporte_incidencia` table (after `asistencia`), its RLS block, and `fn_alumno_buscar_docente` (after `fn_login_lookup`).
- `app/main.py` — register `reportes_router`.
- `app/domains/alumnos/schemas.py` — add `AlumnoBusquedaDocenteOut`.
- `app/domains/alumnos/repository.py` — add `buscar_alumno_plantel`.
- `app/domains/alumnos/service.py` — add `buscar_alumno_plantel` passthrough.
- `app/domains/alumnos/router.py` — add `GET /alumno/buscar-plantel`.
- `tests/test_alumnos.py` — add scope tests for `buscar-plantel`.

**Frontend — new:**
- `frontend/src/api/reportes.ts` — `postReporteIncidencia`, `getReporteIncidencia`.
- `frontend/src/pages/ReporteIncidenciaCapturaPage.tsx` — docente capture form.

**Frontend — modified:**
- `frontend/src/api/alumnos.ts` — add `getAlumnoBuscarPlantel` + `AlumnoBusquedaDocenteOut` type.
- `frontend/src/App.tsx` — route `/reporte-incidencia/capturar`.
- `frontend/src/lib/navItems.ts` — nav item for docente only.
- `frontend/src/pages/PerfilAnalisisAlumnoPage.tsx` — new "Incidencias" section (4th section), directivo/admin only (page is already gated).

**Docs — new:**
- `docs/validacion/reporte-incidencia.md` — closing evidence doc (RLS log + pytest + 3-role manual verification), same format as `docs/validacion/fase-05-calificaciones.md`.

---

## Task 1: DDL + Alembic migration for `reporte_incidencia` and `fn_alumno_buscar_docente`

Before this task starts, a pre-existing bug (unrelated to this feature, found while preparing this plan's environment) was already fixed on this branch: the initial migration `7460fa835be8` used to read the *live* `db/ddl_mvp.sql` at migration-run-time, which broke fresh installs once later features (like `Asistencia`) appended to that file — a truly fresh volume would replay the CURRENT file as "initial schema" and then collide with the later incremental migration that adds the same table again. It now reads a frozen snapshot (`db/migrations_snapshots/ddl_mvp_at_7460fa835be8.sql`) instead. This is already committed; nothing in this task needs to touch it, but don't be surprised to see it in `git log` — it's what makes a fresh `docker-compose down -v && up --build` work at all for Step 3 below.

**Files:**
- Create: `app/db/migrations/versions/b7c2e4f19a03_reporte_incidencia_table_and_rls.py`
- Modify: `db/ddl_mvp.sql`

**Interfaces:**
- Produces: table `reporte_incidencia` with columns `id_reporte_incidencia, id_alumno, id_personal_reporta, fecha_incidente, descripcion, fecha_registro`; policies `reporte_incidencia_select`, `reporte_incidencia_insert`; function `fn_alumno_buscar_docente(p_search VARCHAR)`. All consumed by Task 3/4.

- [ ] **Step 1: Write the migration file**

```python
"""reporte_incidencia table and rls, fn_alumno_buscar_docente

Agrega la tabla `reporte_incidencia` (docs/data_dictionary/reporte-incidencia.md,
diseño cerrado en sesión) y su RLS: cualquier docente activo puede crear
un reporte sobre cualquier alumno del plantel, sin join a grupo_asignatura
(desviación deliberada del patrón de Calificacion/Asistencia -- ver
ADR-010 para el razonamiento completo). Tabla inmutable: sin políticas de
UPDATE/DELETE, Postgres deniega esas operaciones por defecto a cualquier
rol no-owner, incluido admin -- mismo patrón que auditoria_calificacion.

También agrega fn_alumno_buscar_docente, una función SECURITY DEFINER de
un solo propósito (ADR-010, mismo patrón acotado que fn_login_lookup /
ADR-007): permite a un docente buscar CUALQUIER alumno del plantel por
nombre/CURP con campos mínimos, sin ampliar alumno_select.

Revision ID: b7c2e4f19a03
Revises: a1c3f9d2e7b4
Create Date: 2026-08-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b7c2e4f19a03'
down_revision: Union[str, Sequence[str], None] = 'a1c3f9d2e7b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CREATE_TABLE = """
CREATE TABLE reporte_incidencia (
    id_reporte_incidencia SERIAL PRIMARY KEY,
    id_alumno             INT NOT NULL REFERENCES alumno(id_alumno),
    id_personal_reporta   INT NOT NULL REFERENCES personal(id_personal),
    fecha_incidente       DATE NOT NULL,
    descripcion           TEXT NOT NULL,
    fecha_registro        TIMESTAMP NOT NULL DEFAULT now()
);
"""

_CREATE_INDEXES = """
CREATE INDEX idx_reporte_incidencia_alumno ON reporte_incidencia (id_alumno);
CREATE INDEX idx_reporte_incidencia_personal_reporta ON reporte_incidencia (id_personal_reporta);
"""

_ENABLE_RLS = "ALTER TABLE reporte_incidencia ENABLE ROW LEVEL SECURITY;"

_CREATE_POLICIES = """
CREATE POLICY reporte_incidencia_select ON reporte_incidencia
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_personal_reporta = app_current_personal_id()
    );

CREATE POLICY reporte_incidencia_insert ON reporte_incidencia
    FOR INSERT
    WITH CHECK (
        app_current_rol() = 'docente'
        AND id_personal_reporta = app_current_personal_id()
        AND EXISTS (
            SELECT 1 FROM personal
            WHERE id_personal = app_current_personal_id()
              AND estatus = 'activo'
        )
    );
"""

_CREATE_SEARCH_FN = """
CREATE OR REPLACE FUNCTION fn_alumno_buscar_docente(p_search VARCHAR)
RETURNS TABLE (
    id_alumno         INT,
    matricula         VARCHAR(20),
    nombre            VARCHAR(80),
    apellido_paterno  VARCHAR(60),
    apellido_materno  VARCHAR(60)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT a.id_alumno, a.matricula, a.nombre, a.apellido_paterno, a.apellido_materno
    FROM alumno a
    WHERE app_current_rol() = 'docente'
      AND (
        concat_ws(' ', a.nombre, a.apellido_paterno, a.apellido_materno) ILIKE '%' || p_search || '%'
        OR a.curp = upper(p_search)
      );
$$;

REVOKE ALL ON FUNCTION fn_alumno_buscar_docente(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_alumno_buscar_docente(VARCHAR) TO sige_app;
"""

_DROP_SEARCH_FN = "DROP FUNCTION IF EXISTS fn_alumno_buscar_docente(VARCHAR);"
_DROP_TABLE = "DROP TABLE IF EXISTS reporte_incidencia;"


def upgrade() -> None:
    op.execute(_CREATE_TABLE)
    op.execute(_CREATE_INDEXES)
    op.execute(_ENABLE_RLS)
    op.execute(_CREATE_POLICIES)
    op.execute(_CREATE_SEARCH_FN)


def downgrade() -> None:
    op.execute(_DROP_SEARCH_FN)
    # DROP TABLE ya elimina índices, constraints y políticas RLS de la
    # tabla junto con ella -- no hace falta un DROP POLICY/INDEX aparte.
    op.execute(_DROP_TABLE)
```

- [ ] **Step 2: Update `db/ddl_mvp.sql`**

Find the `asistencia` table block (search for `-- 12. ASISTENCIA`) and its indexes (`idx_asistencia_grupo_fecha`), and insert immediately after:

```sql
-- ---------------------------------------------------------------------
-- 13. REPORTE_INCIDENCIA (post-MVP — ver ADR-010 y
-- docs/data_dictionary/reporte-incidencia.md, diseño cerrado en sesión).
-- Tabla inmutable: sin UPDATE/DELETE a nivel de RLS ni de API. Cualquier
-- docente activo puede reportar sobre cualquier alumno del plantel, sin
-- requerir grupo_asignatura (desviación deliberada respecto a
-- Calificacion/Asistencia, ver ADR-010).
-- ---------------------------------------------------------------------
CREATE TABLE reporte_incidencia (
    id_reporte_incidencia SERIAL PRIMARY KEY,
    id_alumno             INT NOT NULL REFERENCES alumno(id_alumno),
    id_personal_reporta   INT NOT NULL REFERENCES personal(id_personal),
    fecha_incidente       DATE NOT NULL,
    descripcion           TEXT NOT NULL,
    fecha_registro        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_reporte_incidencia_alumno ON reporte_incidencia (id_alumno);
CREATE INDEX idx_reporte_incidencia_personal_reporta ON reporte_incidencia (id_personal_reporta);
```

Then find the RLS section for `asistencia` (search for `CREATE POLICY asistencia_update`) and insert immediately after its closing `;`, before the "Resto de tablas" comment block:

```sql
-- ---------------------------------------------------------------------
-- REPORTE_INCIDENCIA: a diferencia de CALIFICACION/ASISTENCIA, el INSERT
-- no filtra por grupo_asignatura -- cualquier docente activo del plantel
-- puede reportar sobre cualquier alumno (ADR-010). id_personal_reporta =
-- app_current_personal_id() sigue siendo obligatorio (anti-suplantación,
-- mismo propósito que asistencia_insert). El EXISTS contra personal.estatus
-- es defensa en profundidad: el JWT no se revalida contra Personal.estatus
-- en cada request (get_current_personal, app/core/security.py), así que
-- un docente dado de baja después de emitido su token seguiría pasando
-- require_roles("docente") hasta que expire -- esta política es quien
-- realmente cierra ese hueco. Sin políticas de UPDATE/DELETE: tabla
-- inmutable, mismo patrón que auditoria_calificacion.
-- ---------------------------------------------------------------------
ALTER TABLE reporte_incidencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY reporte_incidencia_select ON reporte_incidencia
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_personal_reporta = app_current_personal_id()
    );

CREATE POLICY reporte_incidencia_insert ON reporte_incidencia
    FOR INSERT
    WITH CHECK (
        app_current_rol() = 'docente'
        AND id_personal_reporta = app_current_personal_id()
        AND EXISTS (
            SELECT 1 FROM personal
            WHERE id_personal = app_current_personal_id()
              AND estatus = 'activo'
        )
    );
```

Then find the `fn_login_lookup` block (search for `GRANT EXECUTE ON FUNCTION fn_login_lookup`) and insert immediately after it:

```sql
-- =====================================================================
-- BÚSQUEDA DE ALUMNO PARA DOCENTE — ADR-010
-- Excepción puntual y acotada a RLS de `alumno`, mismo patrón que
-- fn_login_lookup (ADR-007): un docente necesita buscar CUALQUIER alumno
-- del plantel para Reporte_Incidencia, fuera de su scope normal
-- (alumno_select lo limita a sus propios grupo_asignatura). Devuelve solo
-- campos mínimos de identificación, y solo cuando app_current_rol() =
-- 'docente' -- para cualquier otro rol, 0 filas. No modifica
-- alumno_select ni ningún otro acceso existente a Alumno.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_alumno_buscar_docente(p_search VARCHAR)
RETURNS TABLE (
    id_alumno         INT,
    matricula         VARCHAR(20),
    nombre            VARCHAR(80),
    apellido_paterno  VARCHAR(60),
    apellido_materno  VARCHAR(60)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT a.id_alumno, a.matricula, a.nombre, a.apellido_paterno, a.apellido_materno
    FROM alumno a
    WHERE app_current_rol() = 'docente'
      AND (
        concat_ws(' ', a.nombre, a.apellido_paterno, a.apellido_materno) ILIKE '%' || p_search || '%'
        OR a.curp = upper(p_search)
      );
$$;

REVOKE ALL ON FUNCTION fn_alumno_buscar_docente(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_alumno_buscar_docente(VARCHAR) TO sige_app;
```

- [ ] **Step 3: Apply the migration locally**

```bash
docker-compose up -d --build
docker-compose logs migrate | tail -20
```

Expected: `migrate` service exits 0, log shows `b7c2e4f19a03` applied. Verify:

```bash
psql -U sige_migrator -d sige -c "SELECT version_num FROM alembic_version;"
```

Expected: `b7c2e4f19a03`.

- [ ] **Step 4: Commit**

```bash
git add app/db/migrations/versions/b7c2e4f19a03_reporte_incidencia_table_and_rls.py db/ddl_mvp.sql
git commit -m "db: add reporte_incidencia table + RLS, fn_alumno_buscar_docente (ADR-010)"
```

---

## Task 2: Validate RLS directly with `sige_app` before writing FastAPI

**Files:**
- Create: `docs/validacion/reporte-incidencia.md` (start it here, finish in Task 9)

**Interfaces:**
- Consumes: table/policies/function from Task 1, already applied to the running Postgres.
- Produces: a validation log proving the RLS shape is correct — Task 3/4 implementers trust this instead of re-deriving RLS behavior.

This mirrors ADR-008's validation order: RLS proven correct with the real runtime role **before** any FastAPI code touches the table. With `docker-compose up -d --build` already running from Task 1, and assuming 2 `personal` rows exist from a manual seed (or reuse the seed script) — `docente1` (activo, `id_personal=1`), `docente2` (activo, `id_personal=2`), `directivo1` (`id_personal=3`), plus an `alumno` (`id_alumno=1`) not linked to either docente's `grupo_asignatura`.

- [ ] **Step 1: Seed minimal data as `sige_migrator` (bypasses RLS)**

```bash
psql -U sige_migrator -d sige -c "
INSERT INTO plantel (nombre_plantel) VALUES ('Plantel RLS test') RETURNING id_plantel;
INSERT INTO personal (id_plantel, curp, nombre, apellido_paterno, email_institucional, rol, password_hash, estatus)
VALUES
  (1, 'CURPDOC0000000001', 'Docente', 'Uno', 'docente1@rls.test', 'docente', 'x', 'activo'),
  (1, 'CURPDOC0000000002', 'Docente', 'Dos', 'docente2@rls.test', 'docente', 'x', 'activo'),
  (1, 'CURPDOC0000000003', 'Docente', 'Baja', 'docente3@rls.test', 'docente', 'x', 'baja'),
  (1, 'CURPDIR0000000001', 'Directivo', 'Uno', 'directivo1@rls.test', 'directivo', 'x', 'activo');
INSERT INTO alumno (id_plantel, matricula, curp, nombre, apellido_paterno, fecha_nacimiento, fecha_inscripcion)
VALUES (1, 'MAT-0001', 'CURPALUM000000001', 'Alumno', 'Uno', '2008-01-01', '2026-01-01');
"
```

- [ ] **Step 2: Confirm INSERT works for an active docente with an alumno outside any relation (the core scope deviation)**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '1', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 1, '2026-08-14', 'Prueba RLS') RETURNING id_reporte_incidencia;
"
```

Expected: 1 row returned, `INSERT 0 1`. This is the exact behavior ADR-010 exists to justify — confirm it works before trusting the design doc's claim.

- [ ] **Step 3: Confirm anti-suplantación — docente cannot insert with someone else's `id_personal_reporta`**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '1', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 2, '2026-08-14', 'Suplantación') RETURNING id_reporte_incidencia;
"
```

Expected: `ERROR: new row violates row-level security policy for table "reporte_incidencia"`.

- [ ] **Step 4: Confirm a deactivated docente cannot insert even with a stale-valid session claim**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '3', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 3, '2026-08-14', 'Docente dado de baja') RETURNING id_reporte_incidencia;
"
```

Expected: `ERROR: new row violates row-level security policy` — this is the case that would slip past `require_roles("docente")` alone (JWT claim still says `docente`), caught only by the `EXISTS` clause against `personal.estatus`.

- [ ] **Step 5: Confirm directivo cannot INSERT (matrix: only docente creates)**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'directivo', false);
SELECT set_config('app.current_personal_id', '4', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 4, '2026-08-14', 'Directivo intentando crear') RETURNING id_reporte_incidencia;
"
```

Expected: `ERROR: new row violates row-level security policy`.

- [ ] **Step 6: Confirm SELECT scope — docente 2 does not see docente 1's report, directivo sees everything**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '2', false);
SELECT count(*) FROM reporte_incidencia;
"
```

Expected: `0` (only docente 1's row exists, from Step 2).

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'directivo', false);
SELECT set_config('app.current_personal_id', '4', false);
SELECT count(*) FROM reporte_incidencia;
"
```

Expected: `1`.

- [ ] **Step 7: Confirm UPDATE/DELETE denied for every role, including admin (defense in depth beyond "no endpoint")**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'admin', false);
SELECT set_config('app.current_personal_id', '4', false);
UPDATE reporte_incidencia SET descripcion = 'editado' WHERE id_reporte_incidencia = 1;
DELETE FROM reporte_incidencia WHERE id_reporte_incidencia = 1;
"
```

Expected: `UPDATE 0` and `DELETE 0` — Postgres denies both silently (no matching row under RLS, since no `UPDATE`/`DELETE` policy exists at all for this table), not an error. Confirm 0 rows affected, matching the exact behavior already documented for `auditoria_calificacion` in `docs/validacion/fase-05-calificaciones.md`.

- [ ] **Step 8: Confirm `fn_alumno_buscar_docente` returns the alumno for a docente, and 0 rows for directivo**

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '2', false);
SELECT * FROM fn_alumno_buscar_docente('Alumno');
"
```

Expected: 1 row (`id_alumno=1`), confirming docente 2 — who has zero relation to this alumno — can still find them via this function, unlike `alumno_select`.

```bash
psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'directivo', false);
SELECT set_config('app.current_personal_id', '4', false);
SELECT * FROM fn_alumno_buscar_docente('Alumno');
"
```

Expected: 0 rows — the function's internal `WHERE app_current_rol() = 'docente'` filters out non-docente callers.

- [ ] **Step 9: Clean up the manual seed and record the log**

```bash
psql -U sige_migrator -d sige -c "TRUNCATE reporte_incidencia, personal, alumno, plantel RESTART IDENTITY CASCADE;"
```

Write `docs/validacion/reporte-incidencia.md` with a "Punto 1 — RLS validada con sige_app antes de FastAPI" section pasting the actual output of Steps 2–8 (real terminal output, not paraphrased) — same format as `docs/validacion/adr-007-login-lookup-validation.md`. This file gets more sections appended in Task 9; do not consider it finished yet.

- [ ] **Step 10: Commit**

```bash
git add docs/validacion/reporte-incidencia.md
git commit -m "docs: validate reporte_incidencia RLS + fn_alumno_buscar_docente with sige_app"
```

---

## Task 3: Backend domain `app/domains/reportes/`

**Files:**
- Create: `app/domains/reportes/__init__.py`
- Create: `app/domains/reportes/models.py`
- Create: `app/domains/reportes/schemas.py`
- Create: `app/domains/reportes/repository.py`
- Create: `app/domains/reportes/service.py`
- Create: `app/domains/reportes/router.py`
- Modify: `app/main.py`

**Interfaces:**
- Consumes: `CurrentPersonal`, `get_current_personal`, `require_roles` from `app/core/security.py`; `get_db` from `app/db/session.py`; `Base` from `app/db`.
- Produces: `POST /reporte-incidencia` (201, `ReporteIncidenciaOut`), `GET /reporte-incidencia?id_alumno=` (200, `list[ReporteIncidenciaOut]`) — consumed by frontend Task 7/8 and tests in Task 5.

- [ ] **Step 1: `app/domains/reportes/__init__.py`**

Empty file (matches `app/domains/asistencia/__init__.py`).

- [ ] **Step 2: `app/domains/reportes/models.py`**

```python
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ReporteIncidencia(Base):
    __tablename__ = "reporte_incidencia"

    id_reporte_incidencia: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_alumno: Mapped[int] = mapped_column(ForeignKey("alumno.id_alumno"), nullable=False)
    id_personal_reporta: Mapped[int] = mapped_column(ForeignKey("personal.id_personal"), nullable=False)
    fecha_incidente: Mapped[date] = mapped_column(Date, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
```

- [ ] **Step 3: `app/domains/reportes/schemas.py`**

```python
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ReporteIncidenciaCreate(BaseModel):
    id_alumno: int
    fecha_incidente: date
    descripcion: str = Field(min_length=1)


class ReporteIncidenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_reporte_incidencia: int
    id_alumno: int
    id_personal_reporta: int
    fecha_incidente: date
    descripcion: str
    fecha_registro: datetime
```

- [ ] **Step 4: `app/domains/reportes/repository.py`**

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.reportes.models import ReporteIncidencia


def list_reporte_incidencia(db: Session, id_alumno: int | None) -> list[ReporteIncidencia]:
    # Sin filtro de rol explícito: reporte_incidencia tiene RLS
    # (reporte_incidencia_select en db/ddl_mvp.sql) -- Postgres ya
    # devuelve solo los reportes del docente autenticado (por autoría,
    # no por grupo_asignatura -- ver ADR-010), o todos para
    # directivo/admin. id_alumno solo acota ESE conjunto ya permitido.
    stmt = select(ReporteIncidencia)
    if id_alumno is not None:
        stmt = stmt.where(ReporteIncidencia.id_alumno == id_alumno)
    return list(db.scalars(stmt))


def create_reporte_incidencia(db: Session, fields: dict) -> ReporteIncidencia:
    reporte = ReporteIncidencia(**fields)
    db.add(reporte)
    db.flush()
    db.refresh(reporte)
    return reporte
```

- [ ] **Step 5: `app/domains/reportes/service.py`**

```python
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.domains.reportes import repository
from app.domains.reportes.models import ReporteIncidencia
from app.domains.reportes.schemas import ReporteIncidenciaCreate


class DocenteInactivoError(Exception):
    """rol='docente' en el JWT pero Personal.estatus != 'activo' -- rechazado
    por reporte_incidencia_insert (RLS), no verificado aparte en Python.
    Cubre el caso donde el JWT sigue vigente pero el docente fue dado de
    baja después de emitirlo (require_roles solo valida el claim del JWT,
    no vuelve a leer Personal.estatus en cada request -- ver ADR-010)."""


def create_reporte_incidencia(
    db: Session, data: ReporteIncidenciaCreate, id_personal_actor: int
) -> ReporteIncidencia:
    fields = data.model_dump()
    fields["id_personal_reporta"] = id_personal_actor
    try:
        return repository.create_reporte_incidencia(db, fields)
    except ProgrammingError as exc:
        db.rollback()
        raise DocenteInactivoError(
            "Solo un docente activo puede levantar un reporte de incidencia"
        ) from exc


def list_reporte_incidencia(db: Session, id_alumno: int | None) -> list[ReporteIncidencia]:
    return repository.list_reporte_incidencia(db, id_alumno)
```

- [ ] **Step 6: `app/domains/reportes/router.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, get_current_personal, require_roles
from app.db.session import get_db
from app.domains.reportes import service
from app.domains.reportes.schemas import ReporteIncidenciaCreate, ReporteIncidenciaOut

router = APIRouter()


# Matriz (docs/data_dictionary/reporte-incidencia.md): solo docente activo
# crea, sobre cualquier alumno del plantel -- reporte_incidencia_insert
# (RLS) no filtra por grupo_asignatura en absoluto (ADR-010, desviación
# deliberada respecto a Calificacion/Asistencia). id_personal_reporta
# nunca viene del payload, siempre se fija aquí desde el JWT.
@router.post(
    "/reporte-incidencia", response_model=ReporteIncidenciaOut, status_code=status.HTTP_201_CREATED
)
def post_reporte_incidencia(
    payload: ReporteIncidenciaCreate,
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(require_roles("docente")),
) -> ReporteIncidenciaOut:
    try:
        return service.create_reporte_incidencia(db, payload, current.id_personal)
    except service.DocenteInactivoError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))


# Scope real lo aplica reporte_incidencia_select (RLS): docente ve solo lo
# que él mismo reportó (por autoría, no por grupo_asignatura), directivo/
# admin ven todo el plantel. id_alumno es un filtro explícito opcional
# (sección "Incidencias" del Perfil de Análisis), no amplía el scope ya
# permitido. Sin PUT/DELETE a propósito -- tabla inmutable (ADR-010).
@router.get("/reporte-incidencia", response_model=list[ReporteIncidenciaOut])
def get_reporte_incidencia(
    id_alumno: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(get_current_personal),
) -> list[ReporteIncidenciaOut]:
    return service.list_reporte_incidencia(db, id_alumno)
```

- [ ] **Step 7: Register the router in `app/main.py`**

Add the import near the other domain router imports (after `asistencia_router`):

```python
from app.domains.reportes.router import router as reportes_router
```

Add the `include_router` call after `app.include_router(asistencia_router, tags=["asistencia"])`:

```python
app.include_router(reportes_router, tags=["reportes"])
```

- [ ] **Step 8: Sanity check the app boots**

```bash
docker-compose up -d --build app
curl -s http://localhost:8000/docs -o /dev/null -w "%{http_code}\n"
```

Expected: `200`.

- [ ] **Step 9: Commit**

```bash
git add app/domains/reportes/ app/main.py
git commit -m "feat: add reporte_incidencia domain (POST/GET, docente-only create)"
```

---

## Task 4: `GET /alumno/buscar-plantel` for docente (backs the search UX)

**Files:**
- Modify: `app/domains/alumnos/schemas.py`
- Modify: `app/domains/alumnos/repository.py`
- Modify: `app/domains/alumnos/service.py`
- Modify: `app/domains/alumnos/router.py`

**Interfaces:**
- Consumes: `fn_alumno_buscar_docente` (Task 1), `require_roles` (`app/core/security.py`).
- Produces: `GET /alumno/buscar-plantel?search=` (200, `list[AlumnoBusquedaDocenteOut]`) — consumed by frontend Task 6/7.

- [ ] **Step 1: Add schema to `app/domains/alumnos/schemas.py`**

Append at the end of the file:

```python
# ADR-010: campos mínimos de identificación devueltos por
# fn_alumno_buscar_docente -- deliberadamente más acotado que
# AlumnoOutDocente (sin curp/fecha_nacimiento/etc.), ya que esta búsqueda
# opera fuera del scope normal de Alumno para un docente.
class AlumnoBusquedaDocenteOut(BaseModel):
    id_alumno: int
    matricula: str
    nombre: str
    apellido_paterno: str
    apellido_materno: str | None
```

(`BaseModel` is already imported at the top of the file, used by every other schema there — no import change needed.)

- [ ] **Step 2: Add repository function to `app/domains/alumnos/repository.py`**

Append:

```python
def buscar_alumno_plantel(db: Session, search: str) -> list[dict]:
    # fn_alumno_buscar_docente (SECURITY DEFINER, ADR-010): bypassea
    # alumno_select a propósito para este único caso de uso -- el filtro
    # de rol vive DENTRO de la función SQL (WHERE app_current_rol() =
    # 'docente'), no aquí, así que un llamado desde cualquier otro rol
    # simplemente devuelve 0 filas.
    rows = db.execute(
        text("SELECT * FROM fn_alumno_buscar_docente(:search)"), {"search": search}
    ).mappings().all()
    return [dict(r) for r in rows]
```

`app/domains/alumnos/repository.py` currently starts with `from sqlalchemy import func, or_, select` — `text` is NOT in that list yet. Change that line to `from sqlalchemy import func, or_, select, text`.

- [ ] **Step 3: Add service passthrough to `app/domains/alumnos/service.py`**

Append:

```python
def buscar_alumno_plantel(db: Session, search: str) -> list[dict]:
    return repository.buscar_alumno_plantel(db, search)
```

- [ ] **Step 4: Add endpoint to `app/domains/alumnos/router.py`**

Add the import for the new schema to the existing `from app.domains.alumnos.schemas import (...)` block:

```python
    AlumnoBusquedaDocenteOut,
```

Add the route (place it before `@router.get("/alumno", ...)` so it's visually grouped with alumno-search concerns, though FastAPI route order doesn't matter here since `/alumno/buscar-plantel` has no path parameter conflict with any existing route):

```python
# ADR-010: excepción de scope -- un docente normalmente solo ve alumnos
# de sus propios grupo_asignatura (alumno_select). Esta búsqueda es
# plantel-completo, respaldada por fn_alumno_buscar_docente (SECURITY
# DEFINER), exclusivamente para poder reportar una incidencia sobre un
# alumno fuera de su scope habitual. No reemplaza GET /alumno?search=.
@router.get("/alumno/buscar-plantel", response_model=list[AlumnoBusquedaDocenteOut])
def get_alumno_buscar_plantel(
    search: str = Query(min_length=1),
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(require_roles("docente")),
) -> list[AlumnoBusquedaDocenteOut]:
    return service.buscar_alumno_plantel(db, search)
```

- [ ] **Step 5: Commit**

```bash
git add app/domains/alumnos/
git commit -m "feat: add GET /alumno/buscar-plantel (docente-only plantel-wide search, ADR-010)"
```

---

## Task 5: Automated tests against real Postgres

**Files:**
- Create: `tests/test_reporte_incidencia.py`
- Modify: `tests/test_alumnos.py`

**Interfaces:**
- Consumes: `client`, `seed` fixtures and `PASSWORD_DOCENTE`, `PASSWORD_DOCENTE_BAJA`, `PASSWORD_DIRECTIVO`, `PASSWORD_ADMIN`, `auth_headers` from `tests/conftest.py`; `_crear_docente` from `tests/test_academico.py`; `_post_alumno` from `tests/test_alumnos.py`.

- [ ] **Step 1: Write `tests/test_reporte_incidencia.py`**

```python
"""Tests de autorización + scope para app/domains/reportes/ (ADR-010):
un docente activo reporta sobre CUALQUIER alumno del plantel, sin
requerir grupo_asignatura -- a diferencia de Calificacion/Asistencia.
"""

from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, PASSWORD_DOCENTE_BAJA, auth_headers
from tests.test_academico import _crear_docente
from tests.test_alumnos import _post_alumno

FECHA = "2026-08-14"


def _post_reporte(client, headers, id_alumno, fecha=FECHA, descripcion="Prueba"):
    return client.post(
        "/reporte-incidencia",
        headers=headers,
        json={"id_alumno": id_alumno, "fecha_incidente": fecha, "descripcion": descripcion},
    )


def test_docente_crea_reporte_sobre_alumno_fuera_de_su_scope_201(client, seed):
    # El alumno no está inscrito en ningún grupo del docente -- a
    # diferencia de Calificacion/Asistencia, esto debe funcionar (ADR-010).
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = _post_reporte(client, docente_headers, alumno["id_alumno"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id_alumno"] == alumno["id_alumno"]
    assert body["id_personal_reporta"] == seed["ids"]["docente1@sige.test"]
    assert body["fecha_incidente"] == FECHA


def test_docente_dado_de_baja_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    baja_headers = auth_headers(client, "docente.baja@sige.test", PASSWORD_DOCENTE_BAJA)
    resp = _post_reporte(client, baja_headers, alumno["id_alumno"])
    assert resp.status_code == 403, resp.text


def test_directivo_no_puede_crear_reporte_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = _post_reporte(client, directivo_headers, alumno["id_alumno"])
    assert resp.status_code == 403, resp.text


def test_docente_no_ve_reporte_de_otro_docente(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE000002", "docente2-pass-1"
    )

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_reporte(client, docente1_headers, alumno["id_alumno"], descripcion="De docente 1")

    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    resp = _post_reporte(client, docente2_headers, alumno["id_alumno"], descripcion="De docente 2")
    assert resp.status_code == 201, resp.text

    listado_docente1 = client.get(
        "/reporte-incidencia", headers=docente1_headers, params={"id_alumno": alumno["id_alumno"]}
    )
    assert listado_docente1.status_code == 200, listado_docente1.text
    descripciones = [r["descripcion"] for r in listado_docente1.json()]
    assert descripciones == ["De docente 1"]


def test_directivo_ve_todos_los_reportes_del_plantel(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_reporte(client, docente_headers, alumno["id_alumno"])

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get(
        "/reporte-incidencia", headers=directivo_headers, params={"id_alumno": alumno["id_alumno"]}
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1


def test_sin_endpoint_put_delete_405(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    creado = _post_reporte(client, docente_headers, alumno["id_alumno"]).json()

    put_resp = client.put(
        f"/reporte-incidencia/{creado['id_reporte_incidencia']}",
        headers=docente_headers,
        json={"descripcion": "editado"},
    )
    assert put_resp.status_code == 405, put_resp.text

    delete_resp = client.delete(
        f"/reporte-incidencia/{creado['id_reporte_incidencia']}", headers=docente_headers
    )
    assert delete_resp.status_code == 405, delete_resp.text


def test_update_delete_directo_bloqueado_por_rls(client, seed):
    # Defensa en profundidad: ni siquiera admin puede UPDATE/DELETE
    # directo a la tabla, no solo "no hay endpoint" -- mismo rigor que
    # auditoria_calificacion (Fase 5).
    import os

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    creado = _post_reporte(client, docente_headers, alumno["id_alumno"]).json()

    app_engine = create_engine(os.environ["DATABASE_URL"])
    AppSession = sessionmaker(bind=app_engine)
    with AppSession() as db:
        db.execute(text("SELECT set_config('app.current_rol', 'admin', true)"))
        db.execute(
            text("SELECT set_config('app.current_personal_id', :id, true)"),
            {"id": str(seed["ids"]["admin1@sige.test"])},
        )
        result = db.execute(
            text("UPDATE reporte_incidencia SET descripcion = 'hackeado' WHERE id_reporte_incidencia = :id"),
            {"id": creado["id_reporte_incidencia"]},
        )
        assert result.rowcount == 0
        result = db.execute(
            text("DELETE FROM reporte_incidencia WHERE id_reporte_incidencia = :id"),
            {"id": creado["id_reporte_incidencia"]},
        )
        assert result.rowcount == 0
        db.rollback()
```

`tests/test_academico.py::_crear_docente`'s exact signature is `_crear_docente(client, admin_headers, seed, email, curp, password)`, returns `id_personal` — the test above already matches it.

`seed["ids"]` (from `tests/conftest.py`'s `seed` fixture) is a dict keyed by `email_institucional` (`SELECT email_institucional, id_personal FROM personal`), so `seed["ids"]["docente1@sige.test"]` and `seed["ids"]["admin1@sige.test"]` are valid as used above. The deactivated docente fixture's email is exactly `"docente.baja@sige.test"` with password `PASSWORD_DOCENTE_BAJA` (both already imported at the top of `tests/test_reporte_incidencia.py` in this plan's Step 1).

Check `seed["ids"]` includes `"docente.baja@sige.test"` and `"admin1@sige.test"` keys — confirm by reading `tests/conftest.py`'s `seed` fixture body in full before running (only the first ~50 lines were read while building this plan); if the email differs from `docente.baja@sige.test`, adjust the test to the real value rather than guessing.

- [ ] **Step 2: Add scope tests for `buscar-plantel` to `tests/test_alumnos.py`**

Append at the end of the file:

```python
def test_buscar_plantel_docente_encuentra_alumno_fuera_de_su_scope_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None, nombre="Zoe")

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno/buscar-plantel", headers=docente_headers, params={"search": "Zoe"})
    assert resp.status_code == 200, resp.text
    assert [a["id_alumno"] for a in resp.json()] == [alumno["id_alumno"]]


def test_buscar_plantel_directivo_forbidden_403(client, seed):
    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/alumno/buscar-plantel", headers=directivo_headers, params={"search": "a"})
    assert resp.status_code == 403, resp.text
```

`PASSWORD_ADMIN`, `PASSWORD_DOCENTE`, `PASSWORD_DIRECTIVO`, `auth_headers` are already imported at the top of `tests/test_alumnos.py`, used by every other test in that file — no import change needed. `_post_alumno(client, headers, seed, n=1, id_grupo=None, **overrides)` passes any extra kwarg straight into the payload via `payload.update(overrides)`, so `_post_alumno(client, admin_headers, seed, n=1, id_grupo=None, nombre="Zoe")` overrides just the `nombre` field and is valid as written above.

- [ ] **Step 3: Run the full suite against real Postgres**

```bash
docker-compose up -d --build
DATABASE_URL_MIGRATIONS=<value from .env> DATABASE_URL=<value from .env> pytest tests/ -v
```

(Use whatever `DATABASE_URL`/`DATABASE_URL_MIGRATIONS` values this project's `.env`/`docker-compose.yml` already define for local test runs — same command used to close every prior phase, see `docs/validacion/fase-05-calificaciones.md`.)

Expected: all tests pass, including the new `test_reporte_incidencia.py` (7 tests) and the 2 new `test_alumnos.py` tests. Record the final pass count (previous total was 176 per `CLAUDE.md` — expect 176 + 9 = 185, adjust if the actual baseline differs).

- [ ] **Step 4: Commit**

```bash
git add tests/test_reporte_incidencia.py tests/test_alumnos.py
git commit -m "test: cover reporte_incidencia scope/immutability + buscar-plantel scope"
```

---

## Task 6: Frontend API clients

**Files:**
- Create: `frontend/src/api/reportes.ts`
- Modify: `frontend/src/api/alumnos.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiPost` from `@/api/client`.
- Produces: `postReporteIncidencia`, `getReporteIncidencia`, `getAlumnoBuscarPlantel`, `AlumnoBusquedaDocenteOut`, `ReporteIncidenciaOut` — consumed by Task 7/8.

- [ ] **Step 1: `frontend/src/api/reportes.ts`**

```typescript
import { apiGet, apiPost } from '@/api/client'

// Contrato real: app/domains/reportes/schemas.py. ADR-010: cualquier
// docente activo reporta sobre cualquier alumno del plantel, sin
// requerir grupo_asignatura -- a diferencia de Calificacion/Asistencia.
export interface ReporteIncidenciaOut {
  id_reporte_incidencia: number
  id_alumno: number
  id_personal_reporta: number
  fecha_incidente: string
  descripcion: string
  fecha_registro: string
}

export interface ReporteIncidenciaCreate {
  id_alumno: number
  fecha_incidente: string
  descripcion: string
}

// Rol(es): D únicamente (require_roles("docente")), activo -- un docente
// dado de baja recibe 403 (RLS, no solo el claim del JWT). Sin PUT/DELETE
// a propósito: tabla inmutable.
export function postReporteIncidencia(data: ReporteIncidenciaCreate): Promise<ReporteIncidenciaOut> {
  return apiPost<ReporteIncidenciaOut>('/reporte-incidencia', data)
}

// Rol(es): D (solo lo que él mismo reportó), X, A (todo el plantel).
// id_alumno es un filtro explícito opcional -- scope real lo aplica RLS.
export function getReporteIncidencia(idAlumno?: number): Promise<ReporteIncidenciaOut[]> {
  const query = idAlumno != null ? `?id_alumno=${idAlumno}` : ''
  return apiGet<ReporteIncidenciaOut[]>(`/reporte-incidencia${query}`)
}
```

- [ ] **Step 2: Add to `frontend/src/api/alumnos.ts`**

Append at the end of the file:

```typescript
// ADR-010: campos mínimos de identificación devueltos por
// fn_alumno_buscar_docente -- deliberadamente más acotado que AlumnoRow
// (sin curp/fecha_nacimiento/etc.), ya que esta búsqueda opera fuera del
// scope normal de Alumno para un docente.
export interface AlumnoBusquedaDocenteOut {
  id_alumno: number
  matricula: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
}

// Rol(es): D únicamente (require_roles("docente")) -- búsqueda
// plantel-completo respaldada por fn_alumno_buscar_docente (SECURITY
// DEFINER, ADR-010), exclusiva para poder reportar una incidencia sobre
// un alumno fuera del scope normal de GET /alumno.
export function getAlumnoBuscarPlantel(search: string): Promise<AlumnoBusquedaDocenteOut[]> {
  return apiGet<AlumnoBusquedaDocenteOut[]>(`/alumno/buscar-plantel?search=${encodeURIComponent(search)}`)
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/reportes.ts frontend/src/api/alumnos.ts
git commit -m "feat(frontend): add API clients for reporte-incidencia and buscar-plantel"
```

---

## Task 7: Frontend capture page for docente

**Files:**
- Create: `frontend/src/pages/ReporteIncidenciaCapturaPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/navItems.ts`

**Interfaces:**
- Consumes: `postReporteIncidencia` (Task 6), `getAlumnoBuscarPlantel` (Task 6), `getPersonalMe`, `useApiQuery`, `buildNavItems`, `DashboardShell`, `clearToken`, `ApiError`/`ForbiddenError`/`UnauthorizedError` from `@/api/client`.

- [ ] **Step 1: `frontend/src/pages/ReporteIncidenciaCapturaPage.tsx`**

```typescript
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlumnoBuscarPlantel, type AlumnoBusquedaDocenteOut } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { postReporteIncidencia } from '@/api/reportes'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

// docs/data_dictionary/reporte-incidencia.md / ADR-010: docente busca
// entre TODOS los alumnos del plantel (GET /alumno/buscar-plantel), no
// solo los de su propio scope -- a diferencia de Calificacion/Asistencia,
// no hay selector de grupo_asignatura aquí en absoluto.
export function ReporteIncidenciaCapturaPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)

  const [busqueda, setBusqueda] = useState('')
  const [query, setQuery] = useState('')
  const fetchResultados = useCallback(
    () => (query ? getAlumnoBuscarPlantel(query) : Promise.resolve<AlumnoBusquedaDocenteOut[]>([])),
    [query],
  )
  const resultados = useApiQuery<AlumnoBusquedaDocenteOut[]>(fetchResultados)

  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoBusquedaDocenteOut | null>(null)
  const [fechaIncidente, setFechaIncidente] = useState(hoy())
  const [descripcion, setDescripcion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || resultados.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, resultados.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function handleBuscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAlumnoSeleccionado(null)
    setQuery(busqueda.trim())
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!alumnoSeleccionado || !descripcion.trim()) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      await postReporteIncidencia({
        id_alumno: alumnoSeleccionado.id_alumno,
        fecha_incidente: fechaIncidente,
        descripcion: descripcion.trim(),
      })
      setSuccess(`Reporte registrado para ${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido_paterno}.`)
      setAlumnoSeleccionado(null)
      setDescripcion('')
      setBusqueda('')
      setQuery('')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para levantar un reporte de incidencia.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo guardar el reporte.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/reporte-incidencia/capturar')}
      greetingSubtitle="Reporta una incidencia de cualquier alumno del plantel."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">
            Reporte de incidencia
          </h2>

          <div aria-live="polite">
            {error && (
              <div className="mb-4 rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                {success}
              </div>
            )}
          </div>

          <form className="space-y-md mb-6" onSubmit={handleBuscar}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="busqueda">
                Buscar alumno (nombre completo o CURP, cualquiera del plantel)
              </label>
              <div className="flex gap-sm">
                <input
                  className="flex-1 px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                  id="busqueda"
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <button
                  className="px-md py-sm rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[44px]"
                  type="submit"
                >
                  Buscar
                </button>
              </div>
            </div>
          </form>

          {resultados.loading && query ? (
            <div className="space-y-2 mb-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} aria-hidden="true" className="h-10 bg-surface-container animate-pulse rounded-lg" />
              ))}
            </div>
          ) : query && resultados.data?.length === 0 ? (
            <p className="text-body-md font-body-md text-secondary mb-6">Sin resultados para "{query}".</p>
          ) : resultados.data && resultados.data.length > 0 && !alumnoSeleccionado ? (
            <ul className="space-y-2 mb-6">
              {resultados.data.map((a) => (
                <li key={a.id_alumno}>
                  <button
                    type="button"
                    className="w-full text-left px-sm py-sm border border-outline-variant rounded-md hover:bg-surface-container font-body-md text-body-md text-on-surface min-h-[44px]"
                    onClick={() => setAlumnoSeleccionado(a)}
                  >
                    {a.matricula} — {a.nombre} {a.apellido_paterno} {a.apellido_materno ?? ''}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {alumnoSeleccionado && (
            <form className="space-y-md" onSubmit={handleSubmit}>
              <div className="px-sm py-sm bg-surface-container rounded-md font-body-md text-body-md text-on-surface flex justify-between items-center">
                <span>
                  Alumno seleccionado: <strong>{alumnoSeleccionado.nombre} {alumnoSeleccionado.apellido_paterno}</strong> ({alumnoSeleccionado.matricula})
                </span>
                <button
                  type="button"
                  className="font-label-md text-label-md text-primary hover:underline"
                  onClick={() => setAlumnoSeleccionado(null)}
                >
                  Cambiar
                </button>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_incidente">
                  Fecha del incidente
                </label>
                <input
                  className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                  id="fecha_incidente"
                  required
                  type="date"
                  value={fechaIncidente}
                  onChange={(e) => setFechaIncidente(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block" htmlFor="descripcion">
                  Descripción
                </label>
                <textarea
                  className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[100px]"
                  id="descripcion"
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="pt-sm">
                <button
                  className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isSubmitting || !descripcion.trim()}
                >
                  {isSubmitting ? 'Guardando…' : 'Registrar reporte'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </DashboardShell>
  )
}
```

- [ ] **Step 2: Register the route in `frontend/src/App.tsx`**

Add the import next to the other page imports:

```typescript
import { ReporteIncidenciaCapturaPage } from '@/pages/ReporteIncidenciaCapturaPage'
```

Add the route next to the other protected routes (same pattern as `/asistencia/capturar`):

```typescript
<Route path="/reporte-incidencia/capturar" element={<ReporteIncidenciaCapturaPage />} />
```

- [ ] **Step 3: Add nav item in `frontend/src/lib/navItems.ts`**

Add after the `Asistencia` item at the end of `buildNavItems`, before the final `return items`:

```typescript
  // Reporte de incidencia (ADR-010): exclusivo de docente -- directivo/
  // admin no tienen pantalla propia de captura (no crean reportes), solo
  // consultan vía la sección "Incidencias" del Perfil de Análisis de
  // Alumno, que ya tiene su propio nav item ("Análisis de alumno").
  if (rol === 'docente') {
    items.push({
      icon: 'report',
      label: 'Incidencias',
      active: activeHref === '/reporte-incidencia/capturar',
      href: '/reporte-incidencia/capturar',
    })
  }
```

- [ ] **Step 4: Type-check and build**

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReporteIncidenciaCapturaPage.tsx frontend/src/App.tsx frontend/src/lib/navItems.ts
git commit -m "feat(frontend): add reporte de incidencia capture page for docente"
```

---

## Task 8: "Incidencias" section in Perfil de Análisis de Alumno

**Files:**
- Modify: `frontend/src/pages/PerfilAnalisisAlumnoPage.tsx`

**Interfaces:**
- Consumes: `getReporteIncidencia` (Task 6), `getPersonal` (`@/api/personal`, already exists, directivo/admin only — used to resolve `id_personal_reporta` → docente name).

- [ ] **Step 1: Extend `fetchPerfil` and `PerfilData` to include incidencias**

Add the import at the top:

```typescript
import { getPersonal, type PersonalOut } from '@/api/personal'
import { getReporteIncidencia, type ReporteIncidenciaOut } from '@/api/reportes'
```

Extend the `PerfilData` interface:

```typescript
interface PerfilData {
  alumno: AlumnoRow | null
  grupoNombre: string
  expediente: ExpedienteAcademicoOut | null
  desempeno: DesempenoRow[]
  resumenAsistencia: AsistenciaResumenOut
  incidencias: ReporteIncidenciaOut[]
  personal: PersonalOut[]
}
```

Extend `fetchPerfil`'s `Promise.all` and return:

```typescript
async function fetchPerfil(idAlumno: number): Promise<PerfilData> {
  const [alumnos, grupos, asignaturas, grupoAsignaturas, calificaciones, periodos, resumenAsistencia, expediente, incidencias, personal] =
    await Promise.all([
      getAlumnosFull(),
      getGrupos(),
      getAsignaturas(),
      getGrupoAsignaturas(),
      getCalificaciones(),
      getPeriodosSemestrales(),
      getAsistenciaResumen(idAlumno),
      getExpedienteAcademico(idAlumno).catch(() => null),
      getReporteIncidencia(idAlumno),
      getPersonal(),
    ])

  // ... (existing alumno/grupoNombre/desempeno derivation unchanged) ...

  return { alumno, grupoNombre, expediente, desempeno, resumenAsistencia, incidencias, personal }
}
```

(Keep every existing line inside the function body as-is — only the destructured array and the final `return` object gain the two new fields.)

- [ ] **Step 2: Add the "Incidencias" section to the JSX**

Add a helper right before the `PerfilAnalisisAlumnoPage` function:

```typescript
function nombreDocenteReporta(personal: PersonalOut[], idPersonal: number): string {
  const p = personal.find((x) => x.id_personal === idPersonal)
  return p ? `${p.nombre} ${p.apellido_paterno}` : `Personal #${idPersonal}`
}
```

Add the section inside the JSX, after the closing `</div>` of the "Asistencia" block (before the final `</>`):

```typescript
            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <h3 className="text-title-md font-title-md font-bold text-on-surface mb-2">Incidencias</h3>
              {perfil.data.incidencias.length === 0 ? (
                <p className="text-body-md font-body-md text-secondary">Sin incidencias registradas.</p>
              ) : (
                <ul className="space-y-3">
                  {perfil.data.incidencias.map((r) => (
                    <li key={r.id_reporte_incidencia} className="border-t border-surface-variant pt-3 first:border-t-0 first:pt-0">
                      <p className="font-label-md text-label-md text-secondary">
                        {r.fecha_incidente} — {nombreDocenteReporta(perfil.data!.personal, r.id_personal_reporta)}
                      </p>
                      <p className="font-body-md text-body-md text-on-surface">{r.descripcion}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
```

This section only ever renders inside the `!esDocente` branch of the page (the whole page already gates on `esDocente` before rendering any of this content), so it inherits the existing directivo/admin-only guard — no separate check needed here.

- [ ] **Step 3: Type-check and build**

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PerfilAnalisisAlumnoPage.tsx
git commit -m "feat(frontend): show Incidencias section in Perfil de Analisis de Alumno"
```

---

## Task 9: Manual 3-role verification + close out validation doc

**Files:**
- Modify: `docs/validacion/reporte-incidencia.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1–8, running end-to-end via `docker-compose up --build` + `npm run dev` (frontend) or `npx vite preview`.

- [ ] **Step 1: Start the full stack**

```bash
docker-compose up -d --build
cd frontend && npm run dev
```

- [ ] **Step 2: As docente1, create a report on an alumno outside their scope**

Log in as a docente, go to `/reporte-incidencia/capturar`, search for an alumno NOT in any of their `grupo_asignatura`, confirm the search returns them, submit a report. Confirm success message. Take a screenshot or paste the network response (real evidence, not a description).

- [ ] **Step 3: As a second docente, confirm they do NOT see the first docente's report**

There's no docente-facing list page for this (only capture) — verify via the API directly: `GET /reporte-incidencia?id_alumno=<id>` with the second docente's token should return `[]` or only their own reports, not the first docente's. Paste the actual curl/response.

- [ ] **Step 4: As directivo, view the Perfil de Análisis of that alumno and confirm the Incidencias section shows the report with the correct docente name and date**

Navigate to `/alumno/buscar`, search the alumno, open their profile, confirm the "Incidencias" section renders. Screenshot.

- [ ] **Step 5: Confirm nobody can edit/delete**

Attempt `PUT`/`DELETE` against `/reporte-incidencia/{id}` with admin credentials via curl — confirm `405` (no route). This was already covered by the automated test in Task 5, but re-confirm live against the running stack as final evidence.

- [ ] **Step 6: Append findings to `docs/validacion/reporte-incidencia.md`**

Follow the same structure as `docs/validacion/fase-05-calificaciones.md` / `docs/validacion/frontend-mvp-cierre.md`: a "Cierre" section summarizing pytest count, the RLS log from Task 2, and the manual 3-role evidence from Steps 2–5 with real pasted output.

- [ ] **Step 7: Update `CLAUDE.md`**

Add a paragraph under "Fase actual" (after the `Perfil de Análisis de Alumno` paragraph) announcing `Reporte_Incidencia` closed, mirroring the style of the `Asistencia` paragraphs — mention ADR-010, the scope deviation, `fn_alumno_buscar_docente`, and the final test count. Add a row to the "Qué leer para qué" table pointing to `docs/data_dictionary/reporte-incidencia.md` and `docs/validacion/reporte-incidencia.md`. Add ADR-010 to the "Resumen de 1 línea por ADR" list.

- [ ] **Step 8: Commit**

```bash
git add docs/validacion/reporte-incidencia.md CLAUDE.md
git commit -m "docs: close out Reporte_Incidencia (ADR-010) with 3-role verification evidence"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered item in the user's original request (DDL without compound UNIQUE, INSERT RLS without grupo_asignatura join, SELECT RLS scoped by author, no UPDATE/DELETE policies + no PUT/DELETE endpoints, migration validated with `sige_app` before FastAPI, POST/GET endpoints, tests for out-of-scope creation / cross-docente isolation / blocked direct UPDATE-DELETE, capture page with plantel-wide search, Incidencias section in Perfil de Análisis, nav item, 3-role verification) is covered by Tasks 1–9.
- **Docente search gap, called out explicitly by the user:** resolved via `fn_alumno_buscar_docente` + `GET /alumno/buscar-plantel` (Tasks 1 & 4), documented as its own architecture decision in ADR-010 rather than silently widening `alumno_select`.
- **ADR numbering:** ADR-010 is next after the existing ADR-009 (`docs/decisions/`); already written this session.
- **Known gap acknowledged, not silently dropped:** Task 2's manual RLS seed data (`personal.password_hash`) uses a placeholder `'x'` for `password_hash` since login isn't exercised in that psql-only step — do not reuse those rows for anything beyond RLS validation, and `TRUNCATE` them in Step 9 before Task 3 onward relies on the `seed` pytest fixture's own data.
