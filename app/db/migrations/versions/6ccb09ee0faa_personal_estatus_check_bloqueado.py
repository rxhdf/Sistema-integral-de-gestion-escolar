"""personal.estatus CHECK amplia a 'bloqueado' (Gestion de Cuentas, Pieza 2)

Agrega un CHECK explicito sobre personal.estatus -- hoy es un VARCHAR(20)
libre, sin CHECK alguno (ni siquiera 'activo'/'baja'), segun
db/ddl_mvp.sql. docs/data_dictionary/gestion-cuentas.md describe esto como
"ampliar" un CHECK preexistente, pero no existia; esta migracion lo crea
de una vez con los 3 valores vigentes ('activo', 'baja', 'bloqueado') en
vez de crear uno de 2 valores para inmediatamente tener que ampliarlo.

fn_login_lookup (ADR-007) ya filtra `estatus = 'activo'` dentro de la
funcion -- un `estatus = 'bloqueado'` queda rechazado en el login sin
tocar esa funcion, verificado explicitamente con curl (ver
docs/validacion/gestion-cuentas.md).

Revision ID: 6ccb09ee0faa
Revises: b7c2e4f19a03
Create Date: 2026-08-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = '6ccb09ee0faa'
down_revision: Union[str, Sequence[str], None] = 'b7c2e4f19a03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_ADD_CHECK = (
    "ALTER TABLE personal ADD CONSTRAINT chk_personal_estatus "
    "CHECK (estatus IN ('activo', 'baja', 'bloqueado'));"
)
_DROP_CHECK = "ALTER TABLE personal DROP CONSTRAINT chk_personal_estatus;"


def upgrade() -> None:
    op.execute(_ADD_CHECK)


def downgrade() -> None:
    op.execute(_DROP_CHECK)
