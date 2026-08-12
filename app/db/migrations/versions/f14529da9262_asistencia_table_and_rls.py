"""asistencia table and rls

Agrega la tabla `asistencia` (registro de asistencia por sesión: alumno x
grupo_asignatura x fecha), sus 2 índices de rendimiento, y sus 3
políticas RLS (select/insert/update), siguiendo el diseño cerrado en
docs/data_dictionary/asistencia.md y el mismo patrón de RLS ya validado
en `calificacion_select`/`calificacion_insert`/`calificacion_update`.

Primera entidad post-MVP (ver ADR-008): ADR-002 excluyó Asistencia del
alcance original del MVP a propósito; ADR-008 documenta por qué se
agrega ahora y confirma que el resto de entidades excluidas por ADR-002
(Familia, Tutor, Expediente_Personal/Escolar) siguen fuera de alcance.

Diferencia deliberada respecto a Calificacion: `asistencia_insert` solo
autoriza rol='docente' (igual que calificacion_insert), pero además
exige `id_personal_registro = app_current_personal_id()` -- mismo
propósito anti-suplantación que `auditoria_calificacion_insert`, ya que
Asistencia no tiene una tabla de auditoría separada (el propio campo
`id_personal_registro` es la única evidencia de quién capturó).

No se reescribe la migración inicial (7460fa835be8): esta es una
migración nueva encadenada, igual que las correcciones de Fase 4/5.
db/ddl_mvp.sql se actualiza con esta misma tabla/RLS como fuente de
verdad legible para instalaciones nuevas.

Revision ID: f14529da9262
Revises: efa3c08ba776
Create Date: 2026-08-11 19:01:33.009739

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f14529da9262'
down_revision: Union[str, Sequence[str], None] = 'efa3c08ba776'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CREATE_TABLE = """
CREATE TABLE asistencia (
    id_asistencia        SERIAL PRIMARY KEY,
    id_alumno            INT NOT NULL REFERENCES alumno(id_alumno),
    id_grupo_asig        INT NOT NULL REFERENCES grupo_asignatura(id_grupo_asig),
    fecha_sesion         DATE NOT NULL,
    estado               VARCHAR(10) NOT NULL CHECK (estado IN ('presente', 'ausente', 'retardo')),
    id_personal_registro INT NOT NULL REFERENCES personal(id_personal),
    fecha_captura        TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_asistencia_alumno_grupo_asig_fecha UNIQUE (id_alumno, id_grupo_asig, fecha_sesion)
);
"""

_CREATE_INDEXES = """
CREATE INDEX idx_asistencia_alumno_periodo ON asistencia (id_alumno);
CREATE INDEX idx_asistencia_grupo_fecha ON asistencia (id_grupo_asig, fecha_sesion);
"""

_ENABLE_RLS = "ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;"

_CREATE_POLICIES = """
CREATE POLICY asistencia_select ON asistencia
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );

CREATE POLICY asistencia_insert ON asistencia
    FOR INSERT
    WITH CHECK (
        app_current_rol() = 'docente'
        AND id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
        AND id_personal_registro = app_current_personal_id()
    );

CREATE POLICY asistencia_update ON asistencia
    FOR UPDATE
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );
"""

_DROP_TABLE = "DROP TABLE IF EXISTS asistencia;"


def upgrade() -> None:
    op.execute(_CREATE_TABLE)
    op.execute(_CREATE_INDEXES)
    op.execute(_ENABLE_RLS)
    op.execute(_CREATE_POLICIES)


def downgrade() -> None:
    # DROP TABLE ya elimina índices, constraints y políticas RLS de la
    # tabla junto con ella -- no hace falta un DROP POLICY/INDEX aparte.
    op.execute(_DROP_TABLE)
