from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Calificacion(Base):
    __tablename__ = "calificacion"
    __table_args__ = (
        CheckConstraint("tipo_evaluacion IN ('ordinaria', 'extraordinaria')", name="chk_tipo_evaluacion"),
        CheckConstraint("estatus IN ('aprobado', 'reprobado', 'pendiente')", name="chk_calificacion_estatus"),
        UniqueConstraint("id_alumno", "id_grupo_asig", name="uq_calificacion_alumno_grupo_asig"),
    )

    id_calificacion: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_alumno: Mapped[int] = mapped_column(ForeignKey("alumno.id_alumno"), nullable=False)
    id_grupo_asig: Mapped[int] = mapped_column(
        ForeignKey("grupo_asignatura.id_grupo_asig"), nullable=False
    )
    parcial_1: Mapped[float | None] = mapped_column(Numeric(4, 1, asdecimal=False))
    parcial_2: Mapped[float | None] = mapped_column(Numeric(4, 1, asdecimal=False))
    parcial_3: Mapped[float | None] = mapped_column(Numeric(4, 1, asdecimal=False))
    calificacion_final: Mapped[float | None] = mapped_column(Numeric(4, 1, asdecimal=False))
    tipo_evaluacion: Mapped[str] = mapped_column(String(20), nullable=False, server_default="ordinaria")
    estatus: Mapped[str] = mapped_column(String(15), nullable=False, server_default="pendiente")
    fecha_captura: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )


class AuditoriaCalificacion(Base):
    __tablename__ = "auditoria_calificacion"
    __table_args__ = (
        CheckConstraint("accion IN ('captura', 'correccion')", name="chk_auditoria_accion"),
    )

    id_auditoria: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_calificacion: Mapped[int] = mapped_column(
        ForeignKey("calificacion.id_calificacion"), nullable=False
    )
    id_personal_capturo: Mapped[int | None] = mapped_column(ForeignKey("personal.id_personal"))
    id_personal_modifico: Mapped[int | None] = mapped_column(ForeignKey("personal.id_personal"))
    accion: Mapped[str] = mapped_column(String(20), nullable=False)
    valores_anteriores: Mapped[dict | None] = mapped_column(JSONB)
    valores_nuevos: Mapped[dict | None] = mapped_column(JSONB)
    fecha_evento: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
