from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Grupo(Base):
    __tablename__ = "grupo"
    __table_args__ = (
        CheckConstraint("semestre BETWEEN 1 AND 6", name="chk_grupo_semestre"),
        UniqueConstraint(
            "id_plantel", "id_periodo", "nombre_grupo", name="uq_grupo_nombre_periodo"
        ),
    )

    id_grupo: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_plantel: Mapped[int] = mapped_column(ForeignKey("plantel.id_plantel"), nullable=False)
    id_periodo: Mapped[int] = mapped_column(
        ForeignKey("periodo_semestral.id_periodo"), nullable=False
    )
    semestre: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    nombre_grupo: Mapped[str] = mapped_column(String(10), nullable=False)
    capacidad_maxima: Mapped[int | None] = mapped_column(Integer)


class Asignatura(Base):
    __tablename__ = "asignatura"
    __table_args__ = (CheckConstraint("semestre BETWEEN 1 AND 6", name="chk_asignatura_semestre"),)

    id_asignatura: Mapped[int] = mapped_column(Integer, primary_key=True)
    clave_asignatura: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    semestre: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class GrupoAsignatura(Base):
    __tablename__ = "grupo_asignatura"
    __table_args__ = (
        UniqueConstraint(
            "id_grupo", "id_asignatura", "id_periodo", name="uq_grupo_asignatura_periodo"
        ),
    )

    id_grupo_asig: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_grupo: Mapped[int] = mapped_column(ForeignKey("grupo.id_grupo"), nullable=False)
    id_asignatura: Mapped[int] = mapped_column(
        ForeignKey("asignatura.id_asignatura"), nullable=False
    )
    id_docente: Mapped[int] = mapped_column(ForeignKey("personal.id_personal"), nullable=False)
    id_periodo: Mapped[int] = mapped_column(
        ForeignKey("periodo_semestral.id_periodo"), nullable=False
    )
