from datetime import date

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.domains.asistencia.models import Asistencia


def list_asistencia(db: Session, id_grupo_asig: int, fecha_sesion: date) -> list[Asistencia]:
    # Sin filtro de rol explícito: asistencia tiene RLS (asistencia_select
    # en db/ddl_mvp.sql) -- Postgres ya devuelve solo las filas del
    # docente autenticado (vía sus grupo_asignatura), o todas para
    # directivo/admin. El filtro por id_grupo_asig/fecha_sesion sí es
    # explícito aquí: es la vista diaria de captura, no "todo lo visible".
    return list(
        db.scalars(
            select(Asistencia).where(
                Asistencia.id_grupo_asig == id_grupo_asig,
                Asistencia.fecha_sesion == fecha_sesion,
            )
        )
    )


def resumen_asistencia(db: Session, id_alumno: int) -> dict[str, int]:
    # Igual que arriba, RLS ya acota qué filas de este alumno son visibles
    # para el rol actual (un docente solo ve las de sus propios
    # grupo_asignatura, aunque el alumno tenga más materias) -- el
    # resumen calculado aquí es sobre ese subconjunto visible, no un
    # bypass a todo el historial del alumno.
    rows = db.execute(
        select(Asistencia.estado, func.count())
        .where(Asistencia.id_alumno == id_alumno)
        .group_by(Asistencia.estado)
    ).all()
    return {estado: count for estado, count in rows}


def upsert_lote(
    db: Session,
    id_grupo_asig: int,
    fecha_sesion: date,
    registros: list[dict],
    id_personal_registro: int,
) -> None:
    """UPSERT en una sola sentencia multi-fila (INSERT ... ON CONFLICT DO
    UPDATE sobre uq_asistencia_alumno_grupo_asig_fecha) -- si el docente ya
    capturó ese grupo+fecha, corrige sin fallar con 409 (a diferencia de
    Calificacion, ver docs/data_dictionary/asistencia.md). RLS evalúa cada
    fila contra asistencia_insert (fila nueva) o asistencia_update (fila en
    conflicto) según corresponda; ambos caminos comparten el mismo
    id_grupo_asig/id_personal_registro para todo el lote, así que la
    autorización es uniforme para todas las filas del lote, no por fila
    individual -- verificado directo contra sige_app antes de este código.
    """
    if not registros:
        return
    values = [
        {
            "id_alumno": r["id_alumno"],
            "id_grupo_asig": id_grupo_asig,
            "fecha_sesion": fecha_sesion,
            "estado": r["estado"],
            "id_personal_registro": id_personal_registro,
        }
        for r in registros
    ]
    stmt = pg_insert(Asistencia).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id_alumno", "id_grupo_asig", "fecha_sesion"],
        set_={
            "estado": stmt.excluded.estado,
            "id_personal_registro": stmt.excluded.id_personal_registro,
            "fecha_captura": text("now()"),
        },
    )
    db.execute(stmt)
