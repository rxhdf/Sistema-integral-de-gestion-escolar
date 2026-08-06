from sqlalchemy.exc import InternalError
from sqlalchemy.orm import Session

from app.domains.academico import repository
from app.domains.academico.models import Asignatura, Grupo, GrupoAsignatura
from app.domains.academico.schemas import (
    AsignaturaCreate,
    AsignaturaUpdate,
    GrupoAsignaturaCreate,
    GrupoAsignaturaUpdate,
    GrupoCreate,
    GrupoUpdate,
)


class DocenteInvalidoError(Exception):
    """id_docente no referencia a un personal con rol='docente' — validado
    por el trigger fn_valida_rol_docente (db/ddl_mvp.sql), no en Python."""


def list_grupo(db: Session) -> list[Grupo]:
    return repository.list_grupo(db)


def create_grupo(db: Session, data: GrupoCreate) -> Grupo:
    return repository.create_grupo(db, data.model_dump())


def update_grupo(db: Session, id_grupo: int, data: GrupoUpdate) -> Grupo | None:
    grupo = repository.get_grupo(db, id_grupo)
    if grupo is None:
        return None
    return repository.update_grupo(db, grupo, data.model_dump(exclude_unset=True))


def list_asignatura(db: Session) -> list[Asignatura]:
    return repository.list_asignatura(db)


def create_asignatura(db: Session, data: AsignaturaCreate) -> Asignatura:
    return repository.create_asignatura(db, data.model_dump())


def update_asignatura(db: Session, id_asignatura: int, data: AsignaturaUpdate) -> Asignatura | None:
    asignatura = repository.get_asignatura(db, id_asignatura)
    if asignatura is None:
        return None
    return repository.update_asignatura(db, asignatura, data.model_dump(exclude_unset=True))


def list_grupo_asignatura(db: Session) -> list[GrupoAsignatura]:
    return repository.list_grupo_asignatura(db)


def create_grupo_asignatura(db: Session, data: GrupoAsignaturaCreate) -> GrupoAsignatura:
    try:
        return repository.create_grupo_asignatura(db, data.model_dump())
    except InternalError as exc:
        db.rollback()
        raise DocenteInvalidoError(
            "id_docente debe referenciar a un registro de personal con rol = docente"
        ) from exc


def update_grupo_asignatura(
    db: Session, id_grupo_asig: int, data: GrupoAsignaturaUpdate
) -> GrupoAsignatura | None:
    grupo_asignatura = repository.get_grupo_asignatura(db, id_grupo_asig)
    if grupo_asignatura is None:
        return None
    try:
        return repository.update_grupo_asignatura(
            db, grupo_asignatura, data.model_dump(exclude_unset=True)
        )
    except InternalError as exc:
        db.rollback()
        raise DocenteInvalidoError(
            "id_docente debe referenciar a un registro de personal con rol = docente"
        ) from exc
