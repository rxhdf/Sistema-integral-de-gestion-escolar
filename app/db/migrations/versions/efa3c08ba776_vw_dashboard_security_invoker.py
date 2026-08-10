"""vw_grupo_num_alumnos / vw_plantel_matricula_total: security_invoker

Corrige un gap encontrado al construir el dashboard (app/domains/dashboard/):
las dos vistas agregadas (db/ddl_mvp.sql) se crearon sin `security_invoker`,
que en Postgres por defecto (`security_invoker = false`) evalua permisos Y
politicas RLS con el owner de la vista -- aqui `sige_migrator`, que tambien
es owner de `alumno`. Un owner de tabla bypassea RLS por defecto (sin
`FORCE ROW LEVEL SECURITY`), asi que el `LEFT JOIN alumno` de ambas vistas
ignoraba `alumno_select` sin importar que rol/sesion (`sige_app`, con
`app.current_rol` en 'docente') hiciera la consulta -- un docente que
consultara la vista directamente (sin pasar por el service, que solo usa
`vw_plantel_matricula_total` para el rol directivo/admin) veia el conteo
real de TODO el plantel, no acotado a sus propios grupos. Mismo patron que
`expediente_academico_select` en Fase 4: el service nunca ejerce el path
inseguro hoy, pero la tabla/vista en si no tenia con que restringir una
consulta directa.

Postgres 15+ soporta `security_invoker` en `CREATE VIEW`/`ALTER VIEW ... SET
(security_invoker = true)`: la vista evalua permisos y RLS con los
privilegios de quien la consulta, no del owner. Con esto, ambas vistas
heredan `alumno_select` tal cual ya esta validada (directivo/admin ven
todo el plantel; docente solo alumnos en grupos donde tiene
grupo_asignatura activa) -- sin necesidad de agregar RLS a `plantel` ni
`grupo`, que siguen sin RLS por fila a proposito (ver nota al final de
db/ddl_mvp.sql, MVP de un solo plantel, bajo riesgo).

No se reescriben migraciones previas: esta es una migracion nueva
encadenada, igual que las correcciones de Fase 4/5. db/ddl_mvp.sql se
actualiza con `security_invoker = true` en la definicion de ambas vistas
como fuente de verdad para instalaciones nuevas.

Revision ID: efa3c08ba776
Revises: 3698a658047c
Create Date: 2026-08-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'efa3c08ba776'
down_revision: Union[str, Sequence[str], None] = '3698a658047c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER VIEW vw_grupo_num_alumnos SET (security_invoker = true);")
    op.execute("ALTER VIEW vw_plantel_matricula_total SET (security_invoker = true);")


def downgrade() -> None:
    op.execute("ALTER VIEW vw_grupo_num_alumnos SET (security_invoker = false);")
    op.execute("ALTER VIEW vw_plantel_matricula_total SET (security_invoker = false);")
