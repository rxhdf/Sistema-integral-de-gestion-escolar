from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_personal, require_roles
from app.db.session import get_db
from app.domains.organizacional import service
from app.domains.organizacional.schemas import (
    CicloEscolarCreate,
    CicloEscolarOut,
    PeriodoSemestralCreate,
    PeriodoSemestralOut,
    PeriodoSemestralUpdate,
    PlantelOut,
    PlantelUpdate,
)

router = APIRouter()

_puede_escribir = require_roles("directivo", "admin")


# No hay POST /plantel: la matriz RBAC (docs/rbac/matriz-rbac-mvp.md,
# Nivel 1) no otorga Create de Plantel a ningún rol — es una sola fila en
# el MVP (docs/data_dictionary/mvp.md #1), no una entidad que se
# alta/da de baja vía API. PUT sí existe (ver más abajo): directivo/admin
# sí tienen U sobre esa única fila.
@router.get("/plantel", response_model=list[PlantelOut])
def get_plantel(
    db: Session = Depends(get_db),
    _current=Depends(get_current_personal),
) -> list[PlantelOut]:
    return service.list_plantel(db)


# Sin {id_plantel} en el path: es la única fila del MVP, no hay
# ambigüedad de cuál plantel editar (mismo razonamiento que GET /plantel
# devolviendo la lista de un solo elemento en vez de filtrar por id).
@router.put("/plantel", response_model=PlantelOut)
def put_plantel(
    payload: PlantelUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> PlantelOut:
    plantel = service.update_plantel(db, payload)
    if plantel is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plantel no encontrado")
    return plantel


@router.get("/ciclo-escolar", response_model=list[CicloEscolarOut])
def get_ciclo_escolar(
    db: Session = Depends(get_db),
    _current=Depends(get_current_personal),
) -> list[CicloEscolarOut]:
    return service.list_ciclo_escolar(db)


@router.post(
    "/ciclo-escolar",
    response_model=CicloEscolarOut,
    status_code=status.HTTP_201_CREATED,
)
def post_ciclo_escolar(
    payload: CicloEscolarCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> CicloEscolarOut:
    return service.create_ciclo_escolar(db, payload)


@router.get("/periodo-semestral", response_model=list[PeriodoSemestralOut])
def get_periodo_semestral(
    db: Session = Depends(get_db),
    _current=Depends(get_current_personal),
) -> list[PeriodoSemestralOut]:
    return service.list_periodo_semestral(db)


@router.post(
    "/periodo-semestral",
    response_model=PeriodoSemestralOut,
    status_code=status.HTTP_201_CREATED,
)
def post_periodo_semestral(
    payload: PeriodoSemestralCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> PeriodoSemestralOut:
    return service.create_periodo_semestral(db, payload)


@router.put("/periodo-semestral/{id_periodo}", response_model=PeriodoSemestralOut)
def put_periodo_semestral(
    id_periodo: int,
    payload: PeriodoSemestralUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> PeriodoSemestralOut:
    periodo = service.set_periodo_semestral_activo(db, id_periodo, payload.activo)
    if periodo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Periodo semestral no encontrado")
    return periodo
