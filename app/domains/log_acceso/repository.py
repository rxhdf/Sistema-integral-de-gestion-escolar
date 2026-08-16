from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.log_acceso.models import LogAcceso


def list_log_acceso(
    db: Session, id_personal: int | None, limit: int, offset: int
) -> list[LogAcceso]:
    # Sin filtro de rol explícito: log_acceso tiene RLS (log_acceso_select
    # en db/ddl_mvp.sql) -- Postgres ya devuelve 0 filas para cualquier rol
    # que no sea admin. id_personal solo acota ese conjunto ya permitido.
    stmt = select(LogAcceso)
    if id_personal is not None:
        stmt = stmt.where(LogAcceso.id_personal == id_personal)
    stmt = stmt.order_by(LogAcceso.fecha_intento.desc(), LogAcceso.id_log.desc())
    stmt = stmt.limit(limit).offset(offset)
    return list(db.scalars(stmt))
