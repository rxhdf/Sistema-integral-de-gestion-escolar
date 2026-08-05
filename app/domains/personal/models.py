from datetime import date

from sqlalchemy import CHAR, CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Personal(Base):
    __tablename__ = "personal"
    __table_args__ = (
        CheckConstraint("rol IN ('docente', 'directivo', 'admin')", name="chk_personal_rol"),
    )

    id_personal: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_plantel: Mapped[int] = mapped_column(ForeignKey("plantel.id_plantel"), nullable=False)
    curp: Mapped[str] = mapped_column(CHAR(18), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    apellido_paterno: Mapped[str] = mapped_column(String(60), nullable=False)
    apellido_materno: Mapped[str | None] = mapped_column(String(60))
    email_institucional: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(20))
    fecha_ingreso: Mapped[date | None] = mapped_column(Date)
    estatus: Mapped[str] = mapped_column(String(20), nullable=False, server_default="activo")
