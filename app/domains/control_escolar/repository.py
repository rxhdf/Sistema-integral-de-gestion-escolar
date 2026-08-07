import json

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.domains.control_escolar.models import AuditoriaCalificacion, Calificacion


def list_calificacion(db: Session) -> list[Calificacion]:
    # Sin filtro explícito: calificacion tiene RLS (calificacion_select en
    # db/ddl_mvp.sql) — Postgres ya devuelve solo las del docente
    # autenticado (vía sus grupo_asignatura), o todas para directivo/admin.
    return list(db.scalars(select(Calificacion)))


def get_calificacion(db: Session, id_calificacion: int) -> Calificacion | None:
    return db.get(Calificacion, id_calificacion)


def create_calificacion(db: Session, fields: dict) -> Calificacion:
    calificacion = Calificacion(**fields)
    db.add(calificacion)
    db.flush()
    db.refresh(calificacion)
    return calificacion


def update_calificacion(db: Session, calificacion: Calificacion, fields: dict) -> Calificacion:
    for key, value in fields.items():
        setattr(calificacion, key, value)
    db.flush()
    db.refresh(calificacion)
    return calificacion


def create_auditoria(db: Session, fields: dict) -> None:
    # INSERT sin RETURNING a propósito (texto crudo, no ORM): un docente
    # puede insertar (WITH CHECK se lo permite si es el autor -- ver
    # migración dac93954f640/f7e7a1890dcc), pero auditoria_calificacion_select
    # le niega TODO acceso de lectura por diseño ("sin acceso para
    # docente"). db.flush()/db.refresh() del ORM usan INSERT ... RETURNING
    # internamente para poblar el id/fecha generados, y Postgres evalúa la
    # política SELECT sobre esa fila devuelta -- eso rechaza el INSERT
    # entero con "violates row-level security policy", aunque el WITH
    # CHECK del INSERT sí lo autorizaba. Nadie usa el id_auditoria/fecha_evento
    # generados aquí (ver service.py), así que evitar RETURNING es
    # suficiente y no requiere tocar la política SELECT.
    db.execute(
        text(
            "INSERT INTO auditoria_calificacion "
            "(id_calificacion, id_personal_capturo, id_personal_modifico, accion, "
            " valores_anteriores, valores_nuevos) "
            "VALUES (:id_calificacion, :id_personal_capturo, :id_personal_modifico, :accion, "
            " :valores_anteriores, :valores_nuevos)"
        ),
        {
            "id_calificacion": fields["id_calificacion"],
            "id_personal_capturo": fields.get("id_personal_capturo"),
            "id_personal_modifico": fields.get("id_personal_modifico"),
            "accion": fields["accion"],
            "valores_anteriores": json.dumps(fields["valores_anteriores"])
            if fields.get("valores_anteriores") is not None
            else None,
            "valores_nuevos": json.dumps(fields["valores_nuevos"])
            if fields.get("valores_nuevos") is not None
            else None,
        },
    )


def list_auditoria(db: Session) -> list[AuditoriaCalificacion]:
    return list(db.scalars(select(AuditoriaCalificacion)))
