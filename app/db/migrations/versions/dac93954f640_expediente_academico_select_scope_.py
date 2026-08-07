"""expediente_academico_select scope docente

Corrige un gap encontrado en Fase 4 (ver docs/validacion/fase-04-alumnos.md):
expediente_academico_select tenia USING(true), es decir, cualquier rol
autenticado -- incluido un docente sin ninguna relacion con el alumno --
podia leer cualquier fila de expediente_academico via una query directa
que no pasara por app/domains/alumnos/service.py (el service si aplicaba
el scope correcto, pero solo protegia ese unico code path, no la tabla).

Esto contradecia directamente el proposito declarado de ADR-001: separar
Expediente_Academico de Alumno "permite aplicar politicas RLS por tabla
completa (un docente nunca tiene ni la posibilidad de hacer join a datos
que no le corresponden)". Esta migracion aplica el mismo scope de fila que
alumno_select (docente ve solo expedientes de alumnos en grupos donde
tiene grupo_asignatura activa; directivo/admin ven todos) directamente en
RLS, igual que ya existe para calificacion_select.

No se reescribe la migracion inicial (7460fa835be8) ni la de ADR-007
(d3f8a1c2b4e6): esas revisiones ya quedaron aplicadas tal cual se
validaron en Fase 0-3, y una migracion nueva encadenada es la forma
correcta de versionar un cambio de esquema posterior. db/ddl_mvp.sql se
actualiza con esta misma politica para que quede como fuente de verdad
legible para instalaciones nuevas.

Revision ID: dac93954f640
Revises: d3f8a1c2b4e6
Create Date: 2026-08-06 17:52:22.847592

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'dac93954f640'
down_revision: Union[str, Sequence[str], None] = 'd3f8a1c2b4e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_DROP_OLD_POLICY = "DROP POLICY IF EXISTS expediente_academico_select ON expediente_academico;"

_CREATE_NEW_POLICY = """
CREATE POLICY expediente_academico_select ON expediente_academico
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_alumno IN (
            SELECT a.id_alumno FROM alumno a
            JOIN grupo_asignatura ga ON ga.id_grupo = a.id_grupo
            WHERE ga.id_docente = app_current_personal_id()
        )
    );
"""

_CREATE_OLD_POLICY = """
CREATE POLICY expediente_academico_select ON expediente_academico
    FOR SELECT
    USING (true);
"""


def upgrade() -> None:
    op.execute(_DROP_OLD_POLICY)
    op.execute(_CREATE_NEW_POLICY)


def downgrade() -> None:
    op.execute(_DROP_OLD_POLICY)
    op.execute(_CREATE_OLD_POLICY)
