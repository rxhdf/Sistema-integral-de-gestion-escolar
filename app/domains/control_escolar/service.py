from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.domains.alumnos.models import ExpedienteAcademico
from app.domains.control_escolar import repository
from app.domains.control_escolar.models import AuditoriaCalificacion, Calificacion
from app.domains.control_escolar.schemas import CalificacionCreate, CalificacionUpdate

# ADR-005 / docs/data_dictionary/mvp.md (#3, "Pendientes abiertos"):
# umbral típico en México, PENDIENTE DE CONFIRMAR con el plantel piloto.
# No cambiar sin actualizar ambos documentos.
UMBRAL_APROBADO = 6


class GrupoAsignaturaAjenoError(Exception):
    """id_grupo_asig no pertenece a una grupo_asignatura del docente
    autenticado -- rechazado por calificacion_insert (RLS, ver
    db/ddl_mvp.sql), no verificado aparte en Python. Mismo patrón que
    DocenteInvalidoError en app/domains/academico/service.py: traduce el
    error crudo de Postgres a un 4xx claro en el router."""


def _calificacion_final(p1: float | None, p2: float | None, p3: float | None) -> float | None:
    # ADR-005 deja la regla de faltantes a la implementación: se promedia
    # sobre los parciales que sí están capturados (no exige los 3) --
    # calificacion_final solo queda en None (estatus 'pendiente') cuando
    # ninguno de los tres se ha capturado todavía.
    parciales = [p for p in (p1, p2, p3) if p is not None]
    if not parciales:
        return None
    return round(sum(parciales) / len(parciales), 1)


def _estatus(calificacion_final: float | None) -> str:
    if calificacion_final is None:
        return "pendiente"
    return "aprobado" if calificacion_final >= UMBRAL_APROBADO else "reprobado"


def _dump(calificacion: Calificacion) -> dict:
    return {
        "parcial_1": calificacion.parcial_1,
        "parcial_2": calificacion.parcial_2,
        "parcial_3": calificacion.parcial_3,
        "calificacion_final": calificacion.calificacion_final,
        "tipo_evaluacion": calificacion.tipo_evaluacion,
        "estatus": calificacion.estatus,
    }


def _recalcular_promedio_expediente(db: Session, id_alumno: int) -> None:
    """ADR-005: promedio_actual = promedio de las calificacion_final ya
    definidas del alumno (las 'pendientes' no cuentan). Si el alumno
    todavía no tiene Expediente_Academico (Fase 4: se crea aparte), no
    hay nada que actualizar.

    Escribe vía fn_actualizar_promedio_actual (SECURITY DEFINER, ver
    migración 3698a658047c) en vez de un UPDATE por ORM:
    expediente_academico_write restringe UPDATE a directivo/admin (Nivel
    1 de la matriz), pero esta recalculación debe correr también cuando
    quien capturó la calificación es un docente -- la función acota la
    excepción a esta única columna derivada, no abre escritura general
    sobre Expediente_Academico para docente.
    """
    expediente_existe = (
        db.scalars(
            select(ExpedienteAcademico.id_alumno).where(ExpedienteAcademico.id_alumno == id_alumno)
        ).first()
        is not None
    )
    if not expediente_existe:
        return
    finales = [
        f
        for f in db.scalars(
            select(Calificacion.calificacion_final).where(Calificacion.id_alumno == id_alumno)
        )
        if f is not None
    ]
    promedio = round(sum(finales) / len(finales), 2) if finales else None
    db.execute(
        text("SELECT fn_actualizar_promedio_actual(:id_alumno, :promedio)"),
        {"id_alumno": id_alumno, "promedio": promedio},
    )


def list_calificacion(db: Session) -> list[Calificacion]:
    return repository.list_calificacion(db)


def create_calificacion(
    db: Session, data: CalificacionCreate, id_personal_actor: int
) -> Calificacion:
    final = _calificacion_final(data.parcial_1, data.parcial_2, data.parcial_3)
    fields = data.model_dump()
    fields["calificacion_final"] = final
    fields["estatus"] = _estatus(final)
    try:
        calificacion = repository.create_calificacion(db, fields)
    except ProgrammingError as exc:
        db.rollback()
        raise GrupoAsignaturaAjenoError(
            "id_grupo_asig debe pertenecer a una grupo_asignatura del docente autenticado"
        ) from exc

    repository.create_auditoria(
        db,
        {
            "id_calificacion": calificacion.id_calificacion,
            "id_personal_capturo": id_personal_actor,
            "accion": "captura",
            "valores_anteriores": None,
            "valores_nuevos": _dump(calificacion),
        },
    )
    _recalcular_promedio_expediente(db, calificacion.id_alumno)
    return calificacion


def update_calificacion(
    db: Session, id_calificacion: int, data: CalificacionUpdate, id_personal_actor: int
) -> Calificacion | None:
    calificacion = repository.get_calificacion(db, id_calificacion)
    if calificacion is None:
        return None

    valores_anteriores = _dump(calificacion)
    fields = data.model_dump(exclude_unset=True)

    p1 = fields.get("parcial_1", calificacion.parcial_1)
    p2 = fields.get("parcial_2", calificacion.parcial_2)
    p3 = fields.get("parcial_3", calificacion.parcial_3)
    final = _calificacion_final(p1, p2, p3)
    fields["calificacion_final"] = final
    fields["estatus"] = _estatus(final)

    calificacion = repository.update_calificacion(db, calificacion, fields)

    repository.create_auditoria(
        db,
        {
            "id_calificacion": calificacion.id_calificacion,
            "id_personal_modifico": id_personal_actor,
            "accion": "correccion",
            "valores_anteriores": valores_anteriores,
            "valores_nuevos": _dump(calificacion),
        },
    )
    _recalcular_promedio_expediente(db, calificacion.id_alumno)
    return calificacion


def list_auditoria(db: Session) -> list[AuditoriaCalificacion]:
    return repository.list_auditoria(db)
