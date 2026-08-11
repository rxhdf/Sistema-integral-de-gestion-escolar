from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, get_current_personal, require_roles
from app.db.session import get_db
from app.domains.alumnos import service
from app.domains.alumnos.schemas import (
    AlumnoCreate,
    AlumnoInscribir,
    AlumnoOutDirectivo,
    AlumnoOutDocente,
    AlumnoUpdate,
    ExpedienteAcademicoCreate,
    ExpedienteAcademicoOut,
    ExpedienteAcademicoUpdate,
)

router = APIRouter()

_puede_escribir = require_roles("directivo", "admin")


# response_model=None a propósito: esta ruta elige entre dos schemas de
# salida distintos según el rol (matriz RBAC Nivel 3 — docente no ve
# fecha_nacimiento/email/telefono_personal). Un response_model fijo no
# puede expresar eso; devolver los dicts ya filtrados por
# AlumnoOutDocente/AlumnoOutDirectivo es lo que garantiza que el campo
# oculto ni siquiera llegue al backend HTTP, no solo que el frontend lo
# ignore.
@router.get("/alumno", response_model=None)
def get_alumno(
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(get_current_personal),
) -> list[dict]:
    alumnos = service.list_alumno(db)
    schema = AlumnoOutDocente if current.rol == "docente" else AlumnoOutDirectivo
    return [schema.model_validate(a).model_dump() for a in alumnos]


@router.post("/alumno", response_model=AlumnoOutDirectivo, status_code=status.HTTP_201_CREATED)
def post_alumno(
    payload: AlumnoCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> AlumnoOutDirectivo:
    try:
        return service.create_alumno(db, payload)
    except service.ValorDuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.put("/alumno/{id_alumno}", response_model=AlumnoOutDirectivo)
def put_alumno(
    id_alumno: int,
    payload: AlumnoUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> AlumnoOutDirectivo:
    alumno = service.update_alumno(db, id_alumno, payload)
    if alumno is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado")
    return alumno


@router.post("/alumno/{id_alumno}/inscribir", response_model=AlumnoOutDirectivo)
def post_alumno_inscribir(
    id_alumno: int,
    payload: AlumnoInscribir,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> AlumnoOutDirectivo:
    alumno = service.inscribir_alumno(db, id_alumno, payload)
    if alumno is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado")
    return alumno


# Scope "mismo que alumno" (docente solo ve expedientes de sus alumnos):
# resuelto en el service reutilizando el RLS de alumno, no reinventado
# aquí — ver comentario en app/domains/alumnos/service.py.
@router.get("/expediente-academico/{id_alumno}", response_model=ExpedienteAcademicoOut)
def get_expediente_academico(
    id_alumno: int,
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(get_current_personal),
) -> ExpedienteAcademicoOut:
    expediente = service.get_expediente(db, id_alumno)
    if expediente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expediente académico no encontrado")
    return expediente


@router.post(
    "/expediente-academico",
    response_model=ExpedienteAcademicoOut,
    status_code=status.HTTP_201_CREATED,
)
def post_expediente_academico(
    payload: ExpedienteAcademicoCreate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> ExpedienteAcademicoOut:
    try:
        return service.create_expediente(db, payload)
    except service.ValorDuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.put("/expediente-academico/{id_alumno}", response_model=ExpedienteAcademicoOut)
def put_expediente_academico(
    id_alumno: int,
    payload: ExpedienteAcademicoUpdate,
    db: Session = Depends(get_db),
    _current=Depends(_puede_escribir),
) -> ExpedienteAcademicoOut:
    expediente = service.update_expediente(db, id_alumno, payload)
    if expediente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expediente académico no encontrado")
    return expediente
