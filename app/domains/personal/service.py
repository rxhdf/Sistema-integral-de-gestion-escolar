from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, hash_password
from app.domains.personal import repository
from app.domains.personal.models import Personal
from app.domains.personal.schemas import PersonalCreate, PersonalUpdate


class LastActiveAdminError(Exception):
    """El único admin activo intentó dar de baja o cambiar su propio rol
    (CLAUDE.md, pendiente de Fase 2: evita que el sistema se quede sin
    ningún admin activo). No vive en RLS ni en constraint de tabla —
    ADR-003 ya documenta que esto se resuelve en el service."""


def create_personal(db: Session, data: PersonalCreate) -> Personal:
    fields = data.model_dump(exclude={"password"})
    fields["password_hash"] = hash_password(data.password)
    return repository.create_personal(db, fields)


def list_personal(db: Session) -> list[Personal]:
    return repository.list_personal(db)


def get_self(db: Session, id_personal: int) -> Personal | None:
    return repository.get_by_id(db, id_personal)


def update_personal(
    db: Session, actor: CurrentPersonal, id_personal: int, data: PersonalUpdate
) -> Personal | None:
    target = repository.get_by_id(db, id_personal)
    if target is None:
        return None

    fields = data.model_dump(exclude_unset=True)

    is_self_edit = actor.id_personal == id_personal
    target_is_active_admin = target.rol == "admin" and target.estatus == "activo"
    if is_self_edit and target_is_active_admin:
        new_rol = fields.get("rol", target.rol)
        new_estatus = fields.get("estatus", target.estatus)
        loses_active_admin = new_rol != "admin" or new_estatus != "activo"
        if loses_active_admin and repository.count_active_admins(db) <= 1:
            raise LastActiveAdminError(
                "No se puede dar de baja ni cambiar el rol del único admin activo"
            )

    return repository.update_personal(db, target, fields)
