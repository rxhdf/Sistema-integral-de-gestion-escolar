from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_current_personal, require_roles
from app.db.session import get_db
from app.domains.academico import service
from app.domains.academico.schemas import (
    AsignaturaCreate,
    AsignaturaOut,
    AsignaturaUpdate,
    GrupoAsignaturaCreate,
    GrupoAsignaturaOut,
    GrupoAsignaturaUpdate,
    GrupoCreate,
    GrupoOut,
    GrupoUpdate,
)

router = APIRouter()

_puede_escribir = require_roles("directivo", "admin")


@router.get("/grupo", response_model=list[GrupoOut])
def get_grupo(
    db: Session = Depends(get_db),
    _current=Depends(get_current_personal),
) -> list[GrupoOut]:
    return service.list_grupo(db)


@router.post("/grupo", response_model=GrupoOut, status_code=status.HTTP_201_CREATED)
def post_grupo(
    payload: GrupoCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> GrupoOut:
    try:
        return service.create_grupo(db, payload)
    except service.ValorDuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.put("/grupo/{id_grupo}", response_model=GrupoOut)
def put_grupo(
    id_grupo: int,
    payload: GrupoUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> GrupoOut:
    grupo = service.update_grupo(db, id_grupo, payload)
    if grupo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grupo no encontrado")
    return grupo


@router.get("/asignatura", response_model=list[AsignaturaOut])
def get_asignatura(
    db: Session = Depends(get_db),
    _current=Depends(get_current_personal),
) -> list[AsignaturaOut]:
    return service.list_asignatura(db)


@router.post("/asignatura", response_model=AsignaturaOut, status_code=status.HTTP_201_CREATED)
def post_asignatura(
    payload: AsignaturaCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> AsignaturaOut:
    try:
        return service.create_asignatura(db, payload)
    except service.ValorDuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.put("/asignatura/{id_asignatura}", response_model=AsignaturaOut)
def put_asignatura(
    id_asignatura: int,
    payload: AsignaturaUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> AsignaturaOut:
    asignatura = service.update_asignatura(db, id_asignatura, payload)
    if asignatura is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignatura no encontrada")
    return asignatura


# GET /grupo-asignatura: sin filtro en el service — RLS (grupo_asignatura_select
# en db/ddl_mvp.sql) ya restringe las filas a las del docente autenticado
# cuando el rol es 'docente'; directivo/admin ven todas (matriz RBAC Nivel 2).
@router.get("/grupo-asignatura", response_model=list[GrupoAsignaturaOut])
def get_grupo_asignatura(
    db: Session = Depends(get_db),
    _current=Depends(get_current_personal),
) -> list[GrupoAsignaturaOut]:
    return service.list_grupo_asignatura(db)


@router.post(
    "/grupo-asignatura", response_model=GrupoAsignaturaOut, status_code=status.HTTP_201_CREATED
)
def post_grupo_asignatura(
    payload: GrupoAsignaturaCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> GrupoAsignaturaOut:
    try:
        return service.create_grupo_asignatura(db, payload)
    except service.DocenteInvalidoError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except service.ValorDuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.put("/grupo-asignatura/{id_grupo_asig}", response_model=GrupoAsignaturaOut)
def put_grupo_asignatura(
    id_grupo_asig: int,
    payload: GrupoAsignaturaUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> GrupoAsignaturaOut:
    try:
        grupo_asignatura = service.update_grupo_asignatura(db, id_grupo_asig, payload)
    except service.DocenteInvalidoError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    if grupo_asignatura is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grupo_Asignatura no encontrado")
    return grupo_asignatura
