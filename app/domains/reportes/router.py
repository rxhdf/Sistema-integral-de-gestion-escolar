from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, get_current_personal, require_roles
from app.db.session import get_db
from app.domains.reportes import service
from app.domains.reportes.schemas import ReporteIncidenciaCreate, ReporteIncidenciaOut

router = APIRouter()


# Matriz (docs/data_dictionary/reporte-incidencia.md): solo docente activo
# crea, sobre cualquier alumno del plantel -- reporte_incidencia_insert
# (RLS) no filtra por grupo_asignatura en absoluto (ADR-010, desviación
# deliberada respecto a Calificacion/Asistencia). id_personal_reporta
# nunca viene del payload, siempre se fija aquí desde el JWT.
@router.post(
    "/reporte-incidencia", response_model=ReporteIncidenciaOut, status_code=status.HTTP_201_CREATED
)
def post_reporte_incidencia(
    payload: ReporteIncidenciaCreate,
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(require_roles("docente")),
) -> ReporteIncidenciaOut:
    try:
        return service.create_reporte_incidencia(db, payload, current.id_personal)
    except service.DocenteInactivoError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))


# Scope real lo aplica reporte_incidencia_select (RLS): docente ve solo lo
# que él mismo reportó (por autoría, no por grupo_asignatura), directivo/
# admin ven todo el plantel. id_alumno es un filtro explícito opcional
# (sección "Incidencias" del Perfil de Análisis), no amplía el scope ya
# permitido. Sin PUT/DELETE a propósito -- tabla inmutable (ADR-010).
@router.get("/reporte-incidencia", response_model=list[ReporteIncidenciaOut])
def get_reporte_incidencia(
    id_alumno: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(get_current_personal),
) -> list[ReporteIncidenciaOut]:
    return service.list_reporte_incidencia(db, id_alumno)
