from datetime import date

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.domains.asistencia import repository
from app.domains.asistencia.models import Asistencia
from app.domains.asistencia.schemas import AsistenciaLoteCreate, AsistenciaResumenOut


class GrupoAsignaturaAjenoError(Exception):
    """id_grupo_asig no pertenece a una grupo_asignatura del docente
    autenticado -- rechazado por asistencia_insert (RLS, ver
    db/ddl_mvp.sql), no verificado aparte en Python. Mismo patrón que
    GrupoAsignaturaAjenoError en app/domains/control_escolar/service.py."""


def create_lote(
    db: Session, data: AsistenciaLoteCreate, id_personal_actor: int
) -> list[Asistencia]:
    registros = [r.model_dump() for r in data.registros]
    try:
        repository.upsert_lote(
            db, data.id_grupo_asig, data.fecha_sesion, registros, id_personal_actor
        )
    except ProgrammingError as exc:
        db.rollback()
        raise GrupoAsignaturaAjenoError(
            "id_grupo_asig debe pertenecer a una grupo_asignatura del docente autenticado"
        ) from exc
    return repository.list_asistencia(db, data.id_grupo_asig, data.fecha_sesion)


def list_asistencia(db: Session, id_grupo_asig: int, fecha_sesion: date) -> list[Asistencia]:
    return repository.list_asistencia(db, id_grupo_asig, fecha_sesion)


def resumen_asistencia(db: Session, id_alumno: int) -> AsistenciaResumenOut:
    counts = repository.resumen_asistencia(db, id_alumno)
    presente = counts.get("presente", 0)
    ausente = counts.get("ausente", 0)
    retardo = counts.get("retardo", 0)
    return AsistenciaResumenOut(
        id_alumno=id_alumno,
        presente=presente,
        ausente=ausente,
        retardo=retardo,
        total=presente + ausente + retardo,
    )
