"""initial schema from ddl_mvp

Traduce db/ddl_mvp.sql (ya validado a mano en Postgres 16) a una migracion
de Alembic: las 11 tablas del MVP, las 2 vistas calculadas, la funcion +
trigger que valida personal.rol = 'docente' en grupo_asignatura, las 2
funciones helper de RLS (app_current_rol / app_current_personal_id, con
missing_ok=true), y las 21 politicas RLS de docs/rbac/matriz-rbac-mvp.md.

No se reescribe el DDL a mano con op.create_table/op.create_check_constraint
porque db/ddl_mvp.sql ya esta escrito y probado como SQL crudo (ver
validacion RLS previa) — transcribirlo a la DSL de Alembic duplicaria ese
trabajo sin ganar nada, con riesgo real de introducir una discrepancia
sutil entre el DDL "fuente de verdad" y la migracion. En su lugar, el
archivo se lee, se separa en sentencias individuales (respetando bloques
$$ ... $$ y comentarios de linea, para no cortar el cuerpo de las
funciones plpgsql) y cada sentencia se ejecuta por separado — así el log
de `alembic upgrade` queda tan legible como el de psql.

Revision ID: 7460fa835be8
Revises:
Create Date: 2026-07-29 20:56:14.334829

"""
import re
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7460fa835be8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# app/db/migrations/versions/ -> app/db/migrations -> app/db -> app -> repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]
_DDL_PATH = _REPO_ROOT / "db" / "ddl_mvp.sql"

_DOLLAR_TAG_RE = re.compile(r"\$[A-Za-z_]*\$")


def _split_sql_statements(sql: str) -> list[str]:
    """Separa un script SQL en sentencias individuales por ';'.

    Ignora los ';' dentro de comentarios de linea (--...), strings entre
    comillas simples, y bloques delimitados por dollar-quoting ($$...$$),
    ya que el cuerpo plpgsql de fn_valida_rol_docente() contiene ';'
    internos que no deben cortar la sentencia.
    """
    statements = []
    buf: list[str] = []
    i, n = 0, len(sql)
    dollar_tag = None
    in_single_quote = False
    in_line_comment = False

    while i < n:
        ch = sql[i]
        if in_line_comment:
            buf.append(ch)
            in_line_comment = ch != "\n"
            i += 1
            continue
        if dollar_tag:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
            else:
                buf.append(ch)
                i += 1
            continue
        if in_single_quote:
            buf.append(ch)
            in_single_quote = ch != "'"
            i += 1
            continue
        if sql.startswith("--", i):
            in_line_comment = True
            buf.append("--")
            i += 2
            continue
        if ch == "'":
            in_single_quote = True
            buf.append(ch)
            i += 1
            continue
        if ch == "$":
            m = _DOLLAR_TAG_RE.match(sql, i)
            if m:
                dollar_tag = m.group(0)
                buf.append(dollar_tag)
                i += len(dollar_tag)
                continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def _is_meaningful(statement: str) -> bool:
    """False si la sentencia son solo lineas de comentario/blancas."""
    return any(
        line.strip() and not line.strip().startswith("--")
        for line in statement.splitlines()
    )


def _first_code_line(statement: str) -> str:
    for line in statement.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            return stripped
    return statement.strip().splitlines()[0]


def upgrade() -> None:
    """Upgrade schema."""
    ddl_sql = _DDL_PATH.read_text(encoding="utf-8")
    statements = [s for s in _split_sql_statements(ddl_sql) if _is_meaningful(s)]

    print(f"-- ejecutando {len(statements)} sentencias desde {_DDL_PATH}")
    for statement in statements:
        print(f"-> {_first_code_line(statement)}")
        op.execute(statement)

    # ADR-006: los GRANT reales viven aqui (versionados con el schema que
    # crean), no en db/init/01_create_app_role.sh — ese script solo crea
    # el rol y cubre tablas futuras via ALTER DEFAULT PRIVILEGES; este
    # GRANT explicito es la fuente de verdad para las tablas de esta
    # migracion y no depende de que el ALTER DEFAULT PRIVILEGES se haya
    # configurado correctamente en el ambiente.
    print("-> GRANT sobre tablas de negocio a sige_app (runtime, sin owner)")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE "
        "ON ALL TABLES IN SCHEMA public TO sige_app;"
    )
    op.execute(
        "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sige_app;"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "DROP TABLE IF EXISTS "
        "auditoria_calificacion, calificacion, expediente_academico, "
        "alumno, grupo_asignatura, asignatura, grupo, personal, "
        "periodo_semestral, ciclo_escolar, plantel "
        "CASCADE;"
    )
    op.execute("DROP FUNCTION IF EXISTS fn_valida_rol_docente() CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS app_current_rol() CASCADE;")
    op.execute("DROP FUNCTION IF EXISTS app_current_personal_id() CASCADE;")
