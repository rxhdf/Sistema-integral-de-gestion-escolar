from sqlalchemy.orm import Session

from app.domains.log_acceso import repository
from app.domains.log_acceso.models import LogAcceso


def list_log_acceso(
    db: Session, id_personal: int | None, limit: int, offset: int
) -> list[LogAcceso]:
    return repository.list_log_acceso(db, id_personal, limit, offset)
