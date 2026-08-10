from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal
from app.domains.dashboard import repository
from app.domains.dashboard.schemas import DashboardDirectivoOut, DashboardDocenteOut


def get_resumen(db: Session, current: CurrentPersonal) -> DashboardDirectivoOut | DashboardDocenteOut:
    if current.rol in ("directivo", "admin"):
        return DashboardDirectivoOut(
            matricula_total=repository.matricula_total(db),
            grupos_activos=repository.grupos_activos(db),
            personal_activo=repository.personal_activo(db),
            asignaturas_configuradas=repository.asignaturas_configuradas(db),
        )
    return DashboardDocenteOut(
        numero_grupos_asignados=repository.grupos_asignados_docente(db),
        numero_alumnos_bajo_responsabilidad=repository.alumnos_bajo_responsabilidad_docente(db),
        calificaciones_pendientes=repository.calificaciones_pendientes_docente(db),
    )
