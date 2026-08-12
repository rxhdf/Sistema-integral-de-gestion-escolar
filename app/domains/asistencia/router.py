from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import CurrentPersonal, get_current_personal, require_roles
from app.db.session import get_db
from app.domains.asistencia import service
from app.domains.asistencia.schemas import AsistenciaLoteCreate, AsistenciaOut, AsistenciaResumenOut

router = APIRouter()


# Matriz RBAC (docs/data_dictionary/asistencia.md): solo docente captura --
# directivo/admin nunca hacen POST /asistencia/lote, solo consultan.
# asistencia_insert (db/ddl_mvp.sql) ya lo restringe también a nivel de
# RLS: un docente que manda un id_grupo_asig ajeno recibe 403 aquí
# (GrupoAsignaturaAjenoError traduce el error crudo de RLS), no solo un
# 500 sin explicación. UPSERT: si el docente ya había capturado ese
# grupo+fecha, esta misma llamada corrige sin fallar -- no hay caso 409
# aquí a propósito (duplicado es corrección normal, no error).
@router.post("/asistencia/lote", response_model=list[AsistenciaOut], status_code=status.HTTP_201_CREATED)
def post_asistencia_lote(
    payload: AsistenciaLoteCreate,
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(require_roles("docente")),
) -> list[AsistenciaOut]:
    try:
        return service.create_lote(db, payload, current.id_personal)
    except service.GrupoAsignaturaAjenoError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc))


# Vista diaria de captura -- D (solo sus grupo_asignatura), X, A (todo el
# plantel). Scope real lo aplica asistencia_select (RLS); el filtro por
# id_grupo_asig/fecha es explícito en el service, no "todo lo visible".
@router.get("/asistencia", response_model=list[AsistenciaOut])
def get_asistencia(
    id_grupo_asig: int,
    fecha: date,
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(get_current_personal),
) -> list[AsistenciaOut]:
    return service.list_asistencia(db, id_grupo_asig, fecha)


# Agregado calculado al vuelo (no persistido, ver schemas.py). Mismo scope
# de asistencia_select: un docente solo agrega sobre las filas que puede
# ver (sus propios grupo_asignatura), no el historial completo del
# alumno si tiene otras materias con otros docentes.
@router.get("/asistencia/resumen/{id_alumno}", response_model=AsistenciaResumenOut)
def get_asistencia_resumen(
    id_alumno: int,
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(get_current_personal),
) -> AsistenciaResumenOut:
    return service.resumen_asistencia(db, id_alumno)
