from datetime import date

from sqlalchemy import CHAR, CheckConstraint, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Alumno(Base):
    __tablename__ = "alumno"

    id_alumno: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_plantel: Mapped[int] = mapped_column(ForeignKey("plantel.id_plantel"), nullable=False)
    id_grupo: Mapped[int | None] = mapped_column(ForeignKey("grupo.id_grupo"))
    matricula: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    curp: Mapped[str] = mapped_column(CHAR(18), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    apellido_paterno: Mapped[str] = mapped_column(String(60), nullable=False)
    apellido_materno: Mapped[str | None] = mapped_column(String(60))
    fecha_nacimiento: Mapped[date] = mapped_column(Date, nullable=False)
    sexo: Mapped[str | None] = mapped_column(CHAR(1))
    email: Mapped[str | None] = mapped_column(String(100))
    telefono_personal: Mapped[str | None] = mapped_column(String(20))
    estatus: Mapped[str] = mapped_column(String(20), nullable=False, server_default="activo")
    fecha_inscripcion: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_baja: Mapped[date | None] = mapped_column(Date)


class ExpedienteAcademico(Base):
    __tablename__ = "expediente_academico"
    __table_args__ = (
        CheckConstraint(
            "situacion_academica IN ('regular', 'irregular', 'condicionado')",
            name="chk_situacion_academica",
        ),
    )

    id_exp_academico: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_alumno: Mapped[int] = mapped_column(
        ForeignKey("alumno.id_alumno"), nullable=False, unique=True
    )
    escuela_procedencia: Mapped[str | None] = mapped_column(String(200))
    promedio_secundaria: Mapped[float | None] = mapped_column(Numeric(4, 2, asdecimal=False))
    promedio_actual: Mapped[float | None] = mapped_column(Numeric(4, 2, asdecimal=False))
    situacion_academica: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="regular"
    )
