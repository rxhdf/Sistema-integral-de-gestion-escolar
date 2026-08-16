from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LogAcceso(Base):
    __tablename__ = "log_acceso"

    id_log: Mapped[int] = mapped_column(Integer, primary_key=True)
    email_intentado: Mapped[str] = mapped_column(String(100), nullable=False)
    id_personal: Mapped[int | None] = mapped_column(ForeignKey("personal.id_personal"))
    exitoso: Mapped[bool] = mapped_column(Boolean, nullable=False)
    motivo_fallo: Mapped[str | None] = mapped_column(String(50))
    fecha_intento: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("now()")
    )
