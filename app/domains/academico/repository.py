from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.academico.models import Asignatura, Grupo, GrupoAsignatura


def list_grupo(db: Session) -> list[Grupo]:
    return list(db.scalars(select(Grupo)))


def get_grupo(db: Session, id_grupo: int) -> Grupo | None:
    return db.get(Grupo, id_grupo)


def create_grupo(db: Session, fields: dict) -> Grupo:
    # flush (no commit): el commit es responsabilidad de get_db al cierre
    # del request (ver app/db/session.py) — un commit aquí resetearía el
    # SET LOCAL de sesión RLS a mitad de request.
    grupo = Grupo(**fields)
    db.add(grupo)
    db.flush()
    db.refresh(grupo)
    return grupo


def update_grupo(db: Session, grupo: Grupo, fields: dict) -> Grupo:
    for key, value in fields.items():
        setattr(grupo, key, value)
    db.flush()
    db.refresh(grupo)
    return grupo


def list_asignatura(db: Session) -> list[Asignatura]:
    return list(db.scalars(select(Asignatura)))


def get_asignatura(db: Session, id_asignatura: int) -> Asignatura | None:
    return db.get(Asignatura, id_asignatura)


def create_asignatura(db: Session, fields: dict) -> Asignatura:
    asignatura = Asignatura(**fields)
    db.add(asignatura)
    db.flush()
    db.refresh(asignatura)
    return asignatura


def update_asignatura(db: Session, asignatura: Asignatura, fields: dict) -> Asignatura:
    for key, value in fields.items():
        setattr(asignatura, key, value)
    db.flush()
    db.refresh(asignatura)
    return asignatura


def list_grupo_asignatura(db: Session) -> list[GrupoAsignatura]:
    # Sin filtro explícito por docente: grupo_asignatura tiene RLS
    # (grupo_asignatura_select en db/ddl_mvp.sql) — Postgres ya devuelve
    # solo las filas del docente autenticado, o todas para directivo/admin.
    return list(db.scalars(select(GrupoAsignatura)))


def get_grupo_asignatura(db: Session, id_grupo_asig: int) -> GrupoAsignatura | None:
    return db.get(GrupoAsignatura, id_grupo_asig)


def create_grupo_asignatura(db: Session, fields: dict) -> GrupoAsignatura:
    grupo_asignatura = GrupoAsignatura(**fields)
    db.add(grupo_asignatura)
    db.flush()
    db.refresh(grupo_asignatura)
    return grupo_asignatura


def update_grupo_asignatura(
    db: Session, grupo_asignatura: GrupoAsignatura, fields: dict
) -> GrupoAsignatura:
    for key, value in fields.items():
        setattr(grupo_asignatura, key, value)
    db.flush()
    db.refresh(grupo_asignatura)
    return grupo_asignatura
