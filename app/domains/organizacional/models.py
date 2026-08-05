from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Plantel(Base):
    __tablename__ = "plantel"

    id_plantel: Mapped[int] = mapped_column(Integer, primary_key=True)
    clave_plantel: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nombre_plantel: Mapped[str] = mapped_column(String(200), nullable=False)
    municipio: Mapped[str] = mapped_column(String(100), nullable=False)
    estado: Mapped[str] = mapped_column(String(80), nullable=False)
    domicilio: Mapped[str | None] = mapped_column(String(300))
    telefono: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(100))
    estatus: Mapped[str] = mapped_column(String(20), nullable=False, server_default="activo")


class CicloEscolar(Base):
    __tablename__ = "ciclo_escolar"
    __table_args__ = (
        CheckConstraint("fecha_fin > fecha_inicio", name="chk_ciclo_fechas"),
        Index(
            "uq_ciclo_escolar_activo",
            "activo",
            unique=True,
            postgresql_where=text("activo = true"),
        ),
    )

    id_ciclo: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")


class PeriodoSemestral(Base):
    __tablename__ = "periodo_semestral"
    __table_args__ = (
        CheckConstraint("numero_periodo IN (1, 2)", name="chk_periodo_numero"),
        CheckConstraint("fecha_fin > fecha_inicio", name="chk_periodo_fechas"),
        UniqueConstraint("id_ciclo", "numero_periodo", name="uq_periodo_ciclo_numero"),
        Index(
            "uq_periodo_semestral_activo",
            "activo",
            unique=True,
            postgresql_where=text("activo = true"),
        ),
    )

    id_periodo: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_ciclo: Mapped[int] = mapped_column(ForeignKey("ciclo_escolar.id_ciclo"), nullable=False)
    clave_periodo: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    numero_periodo: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
