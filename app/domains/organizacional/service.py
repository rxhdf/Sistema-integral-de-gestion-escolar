from sqlalchemy.orm import Session

from app.domains.organizacional import repository
from app.domains.organizacional.models import CicloEscolar, PeriodoSemestral, Plantel
from app.domains.organizacional.schemas import CicloEscolarCreate, PeriodoSemestralCreate


def list_plantel(db: Session) -> list[Plantel]:
    return repository.list_plantel(db)


def list_ciclo_escolar(db: Session) -> list[CicloEscolar]:
    return repository.list_ciclo_escolar(db)


def create_ciclo_escolar(db: Session, data: CicloEscolarCreate) -> CicloEscolar:
    return repository.create_ciclo_escolar(db, data.model_dump())


def list_periodo_semestral(db: Session) -> list[PeriodoSemestral]:
    return repository.list_periodo_semestral(db)


def create_periodo_semestral(db: Session, data: PeriodoSemestralCreate) -> PeriodoSemestral:
    return repository.create_periodo_semestral(db, data.model_dump())


def set_periodo_semestral_activo(
    db: Session, id_periodo: int, activo: bool
) -> PeriodoSemestral | None:
    return repository.set_periodo_semestral_activo(db, id_periodo, activo)
