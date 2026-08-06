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


def list_alumno(db: Session) -> list[Alumno]:
    return repository.list_alumno(db)


def create_alumno(db: Session, data: AlumnoCreate) -> Alumno:
    return repository.create_alumno(db, data.model_dump())


def update_alumno(db: Session, id_alumno: int, data: AlumnoUpdate) -> Alumno | None:
    alumno = repository.get_alumno(db, id_alumno)
    if alumno is None:
        return None
    return repository.update_alumno(db, alumno, data.model_dump(exclude_unset=True))


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
    return repository.create_expediente(db, data.model_dump())


def update_expediente(
    db: Session, id_alumno: int, data: ExpedienteAcademicoUpdate
) -> ExpedienteAcademico | None:
    expediente = repository.get_expediente_by_alumno(db, id_alumno)
    if expediente is None:
        return None
    return repository.update_expediente(db, expediente, data.model_dump(exclude_unset=True))
