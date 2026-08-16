from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, require_roles
from app.db.session import get_db
from app.domains.log_acceso import service
from app.domains.log_acceso.schemas import LogAccesoOut

router = APIRouter()


# Gestión de Cuentas, Pieza 3 (docs/data_dictionary/gestion-cuentas.md):
# solo admin lee -- log_acceso_select (RLS) refuerza lo mismo a nivel de
# fila, defensa en profundidad si este require_roles se relajara en un
# refactor futuro. id_personal es un filtro opcional (historial de una
# persona); sin filtro, pagina el log completo del plantel.
@router.get("/log-acceso", response_model=list[LogAccesoOut])
def get_log_acceso(
    id_personal: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(require_roles("admin")),
) -> list[LogAccesoOut]:
    return service.list_log_acceso(db, id_personal, limit, offset)
