"""alumno municipio_origen y localidad_origen

Agrega dos columnas nullable a `alumno` (municipio_origen,
localidad_origen), reincorporadas del modelo conceptual original que
ADR-002 había dejado fuera del MVP, ahora requeridas por la feature
"Perfil de Análisis de Alumno" (docs/data_dictionary/perfil-analisis-alumno.md).
Nullable, sin backfill -- no rompe filas existentes.

Revision ID: a1c3f9d2e7b4
Revises: f14529da9262
Create Date: 2026-08-11 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1c3f9d2e7b4'
down_revision: Union[str, Sequence[str], None] = 'f14529da9262'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE alumno "
        "ADD COLUMN municipio_origen VARCHAR(100), "
        "ADD COLUMN localidad_origen VARCHAR(100);"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE alumno "
        "DROP COLUMN municipio_origen, "
        "DROP COLUMN localidad_origen;"
    )
