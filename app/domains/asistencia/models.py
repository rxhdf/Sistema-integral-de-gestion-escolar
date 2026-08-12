from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Asistencia(Base):
    __tablename__ = "asistencia"
    __table_args__ = (
        CheckConstraint("estado IN ('presente', 'ausente', 'retardo')", name="chk_asistencia_estado"),
        UniqueConstraint(
            "id_alumno", "id_grupo_asig", "fecha_sesion", name="uq_asistencia_alumno_grupo_asig_fecha"
        ),
    )

    id_asistencia: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_alumno: Mapped[int] = mapped_column(ForeignKey("alumno.id_alumno"), nullable=False)
    id_grupo_asig: Mapped[int] = mapped_column(
        ForeignKey("grupo_asignatura.id_grupo_asig"), nullable=False
    )
    fecha_sesion: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(String(10), nullable=False)
    id_personal_registro: Mapped[int] = mapped_column(ForeignKey("personal.id_personal"), nullable=False)
    fecha_captura: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
