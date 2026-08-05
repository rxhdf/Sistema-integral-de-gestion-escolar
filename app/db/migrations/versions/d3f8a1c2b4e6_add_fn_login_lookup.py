"""add fn_login_lookup (ADR-007)

Agrega fn_login_lookup, la funcion SECURITY DEFINER que resuelve el
huevo-gallina de identidad de sesion en el flujo de login (ver
docs/decisions/ADR-007.md): en ese punto no existe JWT ni SET de
app.current_rol/app.current_personal_id, asi que personal_select (RLS)
deniega por diseno (fail-closed). La funcion corre con los privilegios de
su owner (sige_migrator, quien la crea aqui via esta migracion), consulta
exclusivamente por email exacto y devuelve solo
id_personal/rol/password_hash/estatus -- nunca la fila completa. EXECUTE
se otorga solo a sige_app.

No se reescribe la migracion inicial (7460fa835be8): ese revision ya
quedo aplicado tal cual se valido en Fase 0/1, y una migracion nueva
encadenada es la forma correcta de versionar un cambio de esquema
posterior. db/ddl_mvp.sql (documento de referencia del esquema completo)
se actualiza con este mismo SQL para que quede como fuente de verdad
legible, pero esta migracion no depende de leer ese archivo -- trae su
propio SQL explicito.

Revision ID: d3f8a1c2b4e6
Revises: 7460fa835be8
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd3f8a1c2b4e6'
down_revision: Union[str, Sequence[str], None] = '7460fa835be8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CREATE_FUNCTION = """
CREATE OR REPLACE FUNCTION fn_login_lookup(p_email VARCHAR(100))
RETURNS TABLE (
    id_personal     INT,
    rol             VARCHAR(20),
    password_hash   VARCHAR(255),
    estatus         VARCHAR(20)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT p.id_personal, p.rol, p.password_hash, p.estatus
    FROM personal p
    WHERE p.email_institucional = p_email
      AND p.estatus = 'activo';
$$;
"""

_REVOKE_PUBLIC = "REVOKE ALL ON FUNCTION fn_login_lookup(VARCHAR) FROM PUBLIC;"
_GRANT_APP = "GRANT EXECUTE ON FUNCTION fn_login_lookup(VARCHAR) TO sige_app;"


def upgrade() -> None:
    op.execute(_CREATE_FUNCTION)
    op.execute(_REVOKE_PUBLIC)
    op.execute(_GRANT_APP)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS fn_login_lookup(VARCHAR);")
