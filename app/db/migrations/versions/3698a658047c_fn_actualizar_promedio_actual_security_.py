"""fn_actualizar_promedio_actual security definer

Gap encontrado al implementar Fase 5 (ver
docs/validacion/fase-05-control-escolar.md): expediente_academico_write
restringe UPDATE a directivo/admin (Nivel 1 de la matriz RBAC: docente
solo tiene R sobre Expediente_Academico) -- correcto para los campos que
edita un humano. Pero ADR-005 exige que el service recalcule
promedio_actual automáticamente en cada captura/corrección de
Calificacion, y el caso más común es un docente capturando su propia
calificación. Ese docente legítimamente no puede ni debe poder editar
Expediente_Academico en general -- pero la RLS tal cual estaba también le
bloqueaba esta escritura derivada y automática, dejando el sistema
incapaz de cumplir ADR-005 para el flujo normal (docente captura).

Mismo patrón que ADR-007 (fn_login_lookup): una función SECURITY DEFINER
acotada a una sola columna derivada (promedio_actual, calculado en Python
por ADR-005, nunca editable a mano vía API por ningún rol) -- no abre una
vía para modificar situacion_academica, escuela_procedencia ni ningún
otro campo de Expediente_Academico.

Revision ID: 3698a658047c
Revises: f7e7a1890dcc
Create Date: 2026-08-06 18:28:54.741031

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3698a658047c'
down_revision: Union[str, Sequence[str], None] = 'f7e7a1890dcc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CREATE_FUNCTION = """
CREATE OR REPLACE FUNCTION fn_actualizar_promedio_actual(p_id_alumno INT, p_promedio NUMERIC)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
    UPDATE expediente_academico
    SET promedio_actual = p_promedio
    WHERE id_alumno = p_id_alumno;
$$;
"""

_REVOKE_PUBLIC = "REVOKE ALL ON FUNCTION fn_actualizar_promedio_actual(INT, NUMERIC) FROM PUBLIC;"
_GRANT_APP = "GRANT EXECUTE ON FUNCTION fn_actualizar_promedio_actual(INT, NUMERIC) TO sige_app;"


def upgrade() -> None:
    op.execute(_CREATE_FUNCTION)
    op.execute(_REVOKE_PUBLIC)
    op.execute(_GRANT_APP)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS fn_actualizar_promedio_actual(INT, NUMERIC);")
