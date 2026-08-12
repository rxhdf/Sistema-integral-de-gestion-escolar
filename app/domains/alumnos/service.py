from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domains.alumnos import repository
from app.domains.alumnos.models import Alumno, ExpedienteAcademico
from app.domains.alumnos.schemas import (
    AlumnoCreate,
    AlumnoInscribir,
    AlumnoUpdate,
    ExpedienteAcademicoCreate,
    ExpedienteAcademicoUpdate,
)


class ValorDuplicadoError(Exception):
    """UNIQUE violado (matricula, curp, o un segundo expediente para el
    mismo alumno)."""


# Mismo patrón que app/domains/academico/service.py y
# app/domains/personal/service.py: un solo lugar que traduce el
# constraint_name real de Postgres a un mensaje claro, en vez de que el
# IntegrityError crudo se propague como 500 sin traducir.
_CONSTRAINT_ERRORS: dict[str, str] = {
    "alumno_matricula_key": "Ya existe un alumno con esa matrícula",
    "alumno_curp_key": "Ya existe un alumno con ese CURP",
    "expediente_academico_id_alumno_key": "Ese alumno ya tiene un expediente académico",
}


def _translate_integrity_error(exc: IntegrityError) -> ValorDuplicadoError | None:
    constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    message = _CONSTRAINT_ERRORS.get(constraint)
    if message is None:
        return None
    return ValorDuplicadoError(message)


def list_alumno(db: Session, search: str | None = None) -> list[Alumno]:
    return repository.list_alumno(db, search)


def create_alumno(db: Session, data: AlumnoCreate) -> Alumno:
    try:
        return repository.create_alumno(db, data.model_dump())
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def update_alumno(db: Session, id_alumno: int, data: AlumnoUpdate) -> Alumno | None:
    alumno = repository.get_alumno(db, id_alumno)
    if alumno is None:
        return None
    try:
        return repository.update_alumno(db, alumno, data.model_dump(exclude_unset=True))
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def inscribir_alumno(db: Session, id_alumno: int, data: AlumnoInscribir) -> Alumno | None:
    alumno = repository.get_alumno(db, id_alumno)
    if alumno is None:
        return None
    return repository.update_alumno(db, alumno, {"id_grupo": data.id_grupo})


def get_expediente(db: Session, id_alumno: int) -> ExpedienteAcademico | None:
    # expediente_academico_select es USING(true) en RLS (db/ddl_mvp.sql) —
    # sin scope por fila a nivel de Postgres. El scope "mismo que alumno"
    # de la matriz RBAC se aplica aquí reutilizando el RLS de alumno: si
    # el alumno no es visible para la sesión actual (docente fuera de
    # scope, o no existe), no se expone su expediente tampoco.
    if repository.get_alumno(db, id_alumno) is None:
        return None
    return repository.get_expediente_by_alumno(db, id_alumno)


def create_expediente(db: Session, data: ExpedienteAcademicoCreate) -> ExpedienteAcademico:
    try:
        return repository.create_expediente(db, data.model_dump())
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def update_expediente(
    db: Session, id_alumno: int, data: ExpedienteAcademicoUpdate
) -> ExpedienteAcademico | None:
    expediente = repository.get_expediente_by_alumno(db, id_alumno)
    if expediente is None:
        return None
    return repository.update_expediente(db, expediente, data.model_dump(exclude_unset=True))
