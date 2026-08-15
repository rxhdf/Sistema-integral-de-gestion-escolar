from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ReporteIncidencia(Base):
    __tablename__ = "reporte_incidencia"

    id_reporte_incidencia: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_alumno: Mapped[int] = mapped_column(ForeignKey("alumno.id_alumno"), nullable=False)
    id_personal_reporta: Mapped[int] = mapped_column(ForeignKey("personal.id_personal"), nullable=False)
    fecha_incidente: Mapped[date] = mapped_column(Date, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
