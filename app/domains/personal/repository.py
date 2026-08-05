from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.personal.models import Personal


def get_by_id(db: Session, id_personal: int) -> Personal | None:
    return db.get(Personal, id_personal)


def list_personal(db: Session) -> list[Personal]:
    return list(db.scalars(select(Personal)))


def create_personal(db: Session, fields: dict) -> Personal:
    # flush (no commit): el commit es responsabilidad de get_db al cierre
    # del request (ver app/db/session.py) — un commit aquí resetearía el
    # SET LOCAL de sesión RLS a mitad de request.
    personal = Personal(**fields)
    db.add(personal)
    db.flush()
    db.refresh(personal)
    return personal


def update_personal(db: Session, personal: Personal, fields: dict) -> Personal:
    for key, value in fields.items():
        setattr(personal, key, value)
    db.flush()
    db.refresh(personal)
    return personal


def count_active_admins(db: Session) -> int:
    return db.execute(
        select(func.count())
        .select_from(Personal)
        .where(Personal.rol == "admin", Personal.estatus == "activo")
    ).scalar_one()
