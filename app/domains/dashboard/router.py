from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, get_current_personal
from app.db.session import get_db
from app.domains.dashboard import service
from app.domains.dashboard.schemas import DashboardDirectivoOut, DashboardDocenteOut

router = APIRouter()


# Abierto a los 3 roles (como GET /calificacion, GET /grupo, etc.): no hay
# param de "qué resumen pedir", el rol del JWT decide la forma de la
# respuesta (service.get_resumen). Cada rama solo toca tablas ya protegidas
# por su propia RLS/matriz RBAC -- ningún dato de un rol es visible al otro.
@router.get("/dashboard/resumen", response_model=DashboardDirectivoOut | DashboardDocenteOut)
def get_dashboard_resumen(
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(get_current_personal),
) -> DashboardDirectivoOut | DashboardDocenteOut:
    return service.get_resumen(db, current)
