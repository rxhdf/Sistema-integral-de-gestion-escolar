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
