from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domains.organizacional import repository
from app.domains.organizacional.models import CicloEscolar, PeriodoSemestral, Plantel
from app.domains.organizacional.schemas import (
    CicloEscolarCreate,
    PeriodoSemestralCreate,
    PlantelUpdate,
)


class FechasInvalidasError(Exception):
    """fecha_fin <= fecha_inicio -- rechazado por chk_ciclo_fechas /
    chk_periodo_fechas (db/ddl_mvp.sql), no verificado aparte en Python."""


class ValorDuplicadoError(Exception):
    """UNIQUE violado (nombre, clave_periodo, o combinación
    id_ciclo+numero_periodo ya usada)."""


class YaExisteActivoError(Exception):
    """uq_ciclo_escolar_activo / uq_periodo_semestral_activo (índice único
    parcial): ya hay otra fila con activo=true."""


# constraint_name (tal como lo reporta Postgres, ver diag.constraint_name
# de psycopg2) -> (excepción semántica, mensaje). Un solo lugar que traduce
# los errores crudos de ambos endpoints (POST /ciclo-escolar y
# POST /periodo-semestral comparten el mismo patrón de constraints) en vez
# de repetir el try/except por caso.
_CONSTRAINT_ERRORS: dict[str, tuple[type[Exception], str]] = {
    "chk_ciclo_fechas": (FechasInvalidasError, "fecha_fin debe ser posterior a fecha_inicio"),
    "ciclo_escolar_nombre_key": (ValorDuplicadoError, "Ya existe un ciclo escolar con ese nombre"),
    "uq_ciclo_escolar_activo": (
        YaExisteActivoError,
        "Ya hay otro ciclo escolar activo; desactívalo antes de activar este",
    ),
    "chk_periodo_fechas": (FechasInvalidasError, "fecha_fin debe ser posterior a fecha_inicio"),
    "periodo_semestral_clave_periodo_key": (
        ValorDuplicadoError,
        "Ya existe un periodo semestral con esa clave",
    ),
    "uq_periodo_ciclo_numero": (
        ValorDuplicadoError,
        "Ese ciclo ya tiene un periodo con ese número",
    ),
    "uq_periodo_semestral_activo": (
        YaExisteActivoError,
        "Ya hay otro periodo semestral activo; desactívalo antes de activar este",
    ),
}


def _translate_integrity_error(exc: IntegrityError) -> Exception | None:
    constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    mapped = _CONSTRAINT_ERRORS.get(constraint)
    if mapped is None:
        return None
    error_cls, message = mapped
    return error_cls(message)


def list_plantel(db: Session) -> list[Plantel]:
    return repository.list_plantel(db)


def update_plantel(db: Session, data: PlantelUpdate) -> Plantel | None:
    plantel = repository.get_plantel(db)
    if plantel is None:
        return None
    fields = data.model_dump(exclude_unset=True)
    return repository.update_plantel(db, plantel, fields)


def list_ciclo_escolar(db: Session) -> list[CicloEscolar]:
    return repository.list_ciclo_escolar(db)


def create_ciclo_escolar(db: Session, data: CicloEscolarCreate) -> CicloEscolar:
    try:
        return repository.create_ciclo_escolar(db, data.model_dump())
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def list_periodo_semestral(db: Session) -> list[PeriodoSemestral]:
    return repository.list_periodo_semestral(db)


def create_periodo_semestral(db: Session, data: PeriodoSemestralCreate) -> PeriodoSemestral:
    try:
        return repository.create_periodo_semestral(db, data.model_dump())
    except IntegrityError as exc:
        db.rollback()
        translated = _translate_integrity_error(exc)
        if translated is None:
            raise
        raise translated from exc


def set_periodo_semestral_activo(
    db: Session, id_periodo: int, activo: bool
) -> PeriodoSemestral | None:
    return repository.set_periodo_semestral_activo(db, id_periodo, activo)
