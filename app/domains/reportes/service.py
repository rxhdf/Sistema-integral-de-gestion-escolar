from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.domains.reportes import repository
from app.domains.reportes.models import ReporteIncidencia
from app.domains.reportes.schemas import ReporteIncidenciaCreate


class DocenteInactivoError(Exception):
    """rol='docente' en el JWT pero Personal.estatus != 'activo' -- rechazado
    por reporte_incidencia_insert (RLS), no verificado aparte en Python.
    Cubre el caso donde el JWT sigue vigente pero el docente fue dado de
    baja después de emitirlo (require_roles solo valida el claim del JWT,
    no vuelve a leer Personal.estatus en cada request -- ver ADR-010)."""


def create_reporte_incidencia(
    db: Session, data: ReporteIncidenciaCreate, id_personal_actor: int
) -> ReporteIncidencia:
    fields = data.model_dump()
    fields["id_personal_reporta"] = id_personal_actor
    try:
        return repository.create_reporte_incidencia(db, fields)
    except ProgrammingError as exc:
        db.rollback()
        raise DocenteInactivoError(
            "Solo un docente activo puede levantar un reporte de incidencia"
        ) from exc


def list_reporte_incidencia(db: Session, id_alumno: int | None) -> list[ReporteIncidencia]:
    return repository.list_reporte_incidencia(db, id_alumno)
