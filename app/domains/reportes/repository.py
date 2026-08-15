from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.reportes.models import ReporteIncidencia


def list_reporte_incidencia(db: Session, id_alumno: int | None) -> list[ReporteIncidencia]:
    # Sin filtro de rol explícito: reporte_incidencia tiene RLS
    # (reporte_incidencia_select en db/ddl_mvp.sql) -- Postgres ya
    # devuelve solo los reportes del docente autenticado (por autoría,
    # no por grupo_asignatura -- ver ADR-010), o todos para
    # directivo/admin. id_alumno solo acota ESE conjunto ya permitido.
    stmt = select(ReporteIncidencia)
    if id_alumno is not None:
        stmt = stmt.where(ReporteIncidencia.id_alumno == id_alumno)
    return list(db.scalars(stmt))


def create_reporte_incidencia(db: Session, fields: dict) -> ReporteIncidencia:
    reporte = ReporteIncidencia(**fields)
    db.add(reporte)
    db.flush()
    db.refresh(reporte)
    return reporte
