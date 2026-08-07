from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, get_current_personal, require_roles
from app.db.session import get_db
from app.domains.control_escolar import service
from app.domains.control_escolar.schemas import (
    AuditoriaCalificacionOut,
    CalificacionCreate,
    CalificacionOut,
    CalificacionUpdate,
)

router = APIRouter()


@router.get("/calificacion", response_model=list[CalificacionOut])
def get_calificacion(
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(get_current_personal),
) -> list[CalificacionOut]:
    return service.list_calificacion(db)


# Matriz RBAC Nivel 1: solo docente tiene Create sobre Calificacion --
# directivo/admin solo R, U (ADR-004: corrigen, no capturan de cero).
# calificacion_insert (db/ddl_mvp.sql) ya lo restringe también a nivel de
# RLS: un docente que manda un id_grupo_asig ajeno recibe 403 aquí
# (GrupoAsignaturaAjenoError traduce el error crudo de RLS), no solo un
# 500 sin explicación.
@router.post("/calificacion", response_model=CalificacionOut, status_code=status.HTTP_201_CREATED)
def post_calificacion(
    payload: CalificacionCreate,
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(require_roles("docente")),
) -> CalificacionOut:
    try:
        return service.create_calificacion(db, payload, current.id_personal)
    except service.GrupoAsignaturaAjenoError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))


# Docente (solo sus grupo_asignatura) y directivo/admin (todo el plantel,
# ADR-004) pueden corregir -- el scope real lo aplica calificacion_update
# (RLS): un docente fuera de scope ni siquiera ve la fila (404, no 403).
@router.put("/calificacion/{id_calificacion}", response_model=CalificacionOut)
def put_calificacion(
    id_calificacion: int,
    payload: CalificacionUpdate,
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(get_current_personal),
) -> CalificacionOut:
    calificacion = service.update_calificacion(db, id_calificacion, payload, current.id_personal)
    if calificacion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Calificación no encontrada")
    return calificacion


@router.get("/auditoria-calificacion", response_model=list[AuditoriaCalificacionOut])
def get_auditoria_calificacion(
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(require_roles("directivo", "admin")),
) -> list[AuditoriaCalificacionOut]:
    return service.list_auditoria(db)
