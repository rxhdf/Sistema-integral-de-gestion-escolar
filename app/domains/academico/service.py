from sqlalchemy.exc import IntegrityError, InternalError
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


class ValorDuplicadoError(Exception):
    """UNIQUE violado (nombre_grupo dentro del mismo plantel+periodo,
    clave_asignatura, o combinación grupo+asignatura+periodo ya usada)."""


# Mismo patrón que app/domains/organizacional/service.py y
# app/domains/personal/service.py: un solo lugar que traduce el
# constraint_name real de Postgres a un mensaje claro, en vez de que el
# IntegrityError crudo se propague como 500 sin traducir.
_CONSTRAINT_ERRORS: dict[str, str] = {
    "uq_grupo_nombre_periodo": "Ya existe un grupo con ese nombre en ese plantel y periodo",
    "asignatura_clave_asignatura_key": "Ya existe una asignatura con esa clave",
    "uq_grupo_asignatura_periodo": "Ese grupo ya tiene esa asignatura asignada en ese periodo",
}


def _translate_integrity_error(exc: IntegrityError) -> ValorDuplicadoError | None:
    constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    message = _CONSTRAINT_ERRORS.get(constraint)
    if message is None:
        return None
    return ValorDuplicadoError(message)


def list_grupo(db: Session) -> list[Grupo]:
    return repository.list_grupo(db)


def create_grupo(db: Session, data: GrupoCreate) -> Grupo:
    try:
        return repository.create_grupo(db, data.model_dump())
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def update_grupo(db: Session, id_grupo: int, data: GrupoUpdate) -> Grupo | None:
    grupo = repository.get_grupo(db, id_grupo)
    if grupo is None:
        return None
    try:
        return repository.update_grupo(db, grupo, data.model_dump(exclude_unset=True))
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def list_asignatura(db: Session) -> list[Asignatura]:
    return repository.list_asignatura(db)


def create_asignatura(db: Session, data: AsignaturaCreate) -> Asignatura:
    try:
        return repository.create_asignatura(db, data.model_dump())
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


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
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


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
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc
