from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.domains.organizacional.models import CicloEscolar, PeriodoSemestral, Plantel


def list_plantel(db: Session) -> list[Plantel]:
    return list(db.scalars(select(Plantel)))


def get_plantel(db: Session) -> Plantel | None:
    return db.scalars(select(Plantel)).first()


def update_plantel(db: Session, plantel: Plantel, fields: dict) -> Plantel:
    for key, value in fields.items():
        setattr(plantel, key, value)
    db.flush()
    db.refresh(plantel)
    return plantel


def list_ciclo_escolar(db: Session) -> list[CicloEscolar]:
    return list(db.scalars(select(CicloEscolar)))


def create_ciclo_escolar(db: Session, fields: dict) -> CicloEscolar:
    # flush (no commit): el commit es responsabilidad de get_db al cierre
    # del request (ver app/db/session.py) — un commit aquí resetearía el
    # SET LOCAL de sesión RLS a mitad de request.
    ciclo = CicloEscolar(**fields)
    db.add(ciclo)
    db.flush()
    db.refresh(ciclo)
    return ciclo


def list_periodo_semestral(db: Session) -> list[PeriodoSemestral]:
    return list(db.scalars(select(PeriodoSemestral)))


def create_periodo_semestral(db: Session, fields: dict) -> PeriodoSemestral:
    periodo = PeriodoSemestral(**fields)
    db.add(periodo)
    db.flush()
    db.refresh(periodo)
    return periodo


def set_periodo_semestral_activo(
    db: Session, id_periodo: int, activo: bool
) -> PeriodoSemestral | None:
    periodo = db.get(PeriodoSemestral, id_periodo)
    if periodo is None:
        return None
    if activo:
        # uq_periodo_semestral_activo (índice único parcial): solo un
        # periodo puede estar activo a la vez — desactivar cualquier otro
        # antes de activar este, en la misma transacción.
        db.execute(
            update(PeriodoSemestral)
            .where(PeriodoSemestral.activo.is_(True), PeriodoSemestral.id_periodo != id_periodo)
            .values(activo=False)
        )
    periodo.activo = activo
    db.flush()
    db.refresh(periodo)
    return periodo
