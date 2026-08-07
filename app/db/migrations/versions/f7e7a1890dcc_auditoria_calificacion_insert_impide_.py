"""auditoria_calificacion_insert impide suplantar autor

Corrige un gap encontrado al revisar RLS antes de Fase 5 (ver
docs/validacion/fase-05-control-escolar.md): auditoria_calificacion_insert
tenia WITH CHECK(true) -- cualquier sesion autenticada, incluido un
docente sin relacion con la calificacion, podia insertar una fila de
auditoria suplantando cualquier id_personal_capturo/id_personal_modifico,
con cualquier accion y cualquier valores_anteriores/valores_nuevos.

El comentario original en db/ddl_mvp.sql reconocia la decision ("el
control real vive en la logica de aplicacion, no en RLS") -- a diferencia
del gap de expediente_academico (Fase 4), este fue una decision
consciente en su momento, no un descuido. Pero es el mismo patron: un
check de BD que no hace nada, dependiendo por completo de que el codigo
de aplicacion futuro nunca inserte mal. Ahora que Fase 5 empieza a
escribir de verdad en esta tabla, se corrige antes de construir encima.

El nuevo WITH CHECK no duplica la regla de negocio completa de quien
puede capturar/corregir (eso lo sigue decidiendo calificacion_insert /
calificacion_update via su propio RLS, mas el service) -- solo impide que
la fila de auditoria mienta sobre QUIEN la esta insertando: accion
'captura' exige id_personal_capturo = app_current_personal_id(); accion
'correccion' exige id_personal_modifico = app_current_personal_id().

No se reescriben migraciones previas (7460fa835be8, d3f8a1c2b4e6,
dac93954f640): esta es una migracion nueva encadenada, igual que la
correccion de expediente_academico_select en Fase 4. db/ddl_mvp.sql se
actualiza con esta misma politica como fuente de verdad.

Revision ID: f7e7a1890dcc
Revises: dac93954f640
Create Date: 2026-08-06 18:08:42.603993

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f7e7a1890dcc'
down_revision: Union[str, Sequence[str], None] = 'dac93954f640'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_DROP_OLD_POLICY = (
    "DROP POLICY IF EXISTS auditoria_calificacion_insert ON auditoria_calificacion;"
)

_CREATE_NEW_POLICY = """
CREATE POLICY auditoria_calificacion_insert ON auditoria_calificacion
    FOR INSERT
    WITH CHECK (
        CASE accion
            WHEN 'captura'    THEN id_personal_capturo  = app_current_personal_id()
            WHEN 'correccion' THEN id_personal_modifico = app_current_personal_id()
        END
    );
"""

_CREATE_OLD_POLICY = """
CREATE POLICY auditoria_calificacion_insert ON auditoria_calificacion
    FOR INSERT
    WITH CHECK (true);
"""


def upgrade() -> None:
    op.execute(_DROP_OLD_POLICY)
    op.execute(_CREATE_NEW_POLICY)


def downgrade() -> None:
    op.execute(_DROP_OLD_POLICY)
    op.execute(_CREATE_OLD_POLICY)
