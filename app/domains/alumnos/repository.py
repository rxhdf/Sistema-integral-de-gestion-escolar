from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.domains.alumnos.models import Alumno, ExpedienteAcademico


def list_alumno(db: Session, search: str | None = None) -> list[Alumno]:
    # Sin filtro explícito por docente: alumno tiene RLS (alumno_select en
    # db/ddl_mvp.sql) — Postgres ya devuelve solo los alumnos de grupos
    # donde el docente autenticado tiene grupo_asignatura, o todos para
    # directivo/admin. `search` solo acota ESE conjunto ya permitido, no
    # amplía el scope.
    stmt = select(Alumno)
    if search:
        nombre_completo = func.concat_ws(
            " ", Alumno.nombre, Alumno.apellido_paterno, Alumno.apellido_materno
        )
        stmt = stmt.where(
            or_(nombre_completo.ilike(f"%{search}%"), Alumno.curp == search.upper())
        )
    return list(db.scalars(stmt))


def get_alumno(db: Session, id_alumno: int) -> Alumno | None:
    return db.get(Alumno, id_alumno)


def create_alumno(db: Session, fields: dict) -> Alumno:
    alumno = Alumno(**fields)
    db.add(alumno)
    db.flush()
    db.refresh(alumno)
    return alumno


def update_alumno(db: Session, alumno: Alumno, fields: dict) -> Alumno:
    for key, value in fields.items():
        setattr(alumno, key, value)
    db.flush()
    db.refresh(alumno)
    return alumno


def get_expediente_by_alumno(db: Session, id_alumno: int) -> ExpedienteAcademico | None:
    return db.scalars(
        select(ExpedienteAcademico).where(ExpedienteAcademico.id_alumno == id_alumno)
    ).first()


def create_expediente(db: Session, fields: dict) -> ExpedienteAcademico:
    expediente = ExpedienteAcademico(**fields)
    db.add(expediente)
    db.flush()
    db.refresh(expediente)
    return expediente


def update_expediente(
    db: Session, expediente: ExpedienteAcademico, fields: dict
) -> ExpedienteAcademico:
    for key, value in fields.items():
        setattr(expediente, key, value)
    db.flush()
    db.refresh(expediente)
    return expediente
