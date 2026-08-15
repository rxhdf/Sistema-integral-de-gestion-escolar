from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SituacionAcademica = Literal["regular", "irregular", "condicionado"]


class AlumnoOutDocente(BaseModel):
    """Matriz RBAC Nivel 3: vista de docente — sin fecha_nacimiento, email
    ni telefono_personal."""

    model_config = ConfigDict(from_attributes=True)

    id_alumno: int
    id_plantel: int
    id_grupo: int | None
    matricula: str
    curp: str
    nombre: str
    apellido_paterno: str
    apellido_materno: str | None
    sexo: str | None
    estatus: str
    fecha_inscripcion: date
    fecha_baja: date | None


class AlumnoOutDirectivo(AlumnoOutDocente):
    """Vista de directivo/admin: todos los campos.

    municipio_origen/localidad_origen excluidos de AlumnoOutDocente a
    propósito: se agregaron para "Perfil de Análisis de Alumno"
    (directivo/admin exclusivo, sin caso de uso para docente) -- mismo
    criterio que fecha_nacimiento/email/telefono_personal.
    """

    fecha_nacimiento: date
    email: str | None
    telefono_personal: str | None
    municipio_origen: str | None
    localidad_origen: str | None


class AlumnoCreate(BaseModel):
    id_plantel: int
    id_grupo: int | None = None
    matricula: str = Field(max_length=20)
    curp: str = Field(min_length=18, max_length=18)
    nombre: str = Field(max_length=80)
    apellido_paterno: str = Field(max_length=60)
    apellido_materno: str | None = Field(default=None, max_length=60)
    fecha_nacimiento: date
    sexo: str | None = Field(default=None, max_length=1)
    email: str | None = Field(default=None, max_length=100)
    telefono_personal: str | None = Field(default=None, max_length=20)
    fecha_inscripcion: date
    municipio_origen: str | None = Field(default=None, max_length=100)
    localidad_origen: str | None = Field(default=None, max_length=100)


class AlumnoUpdate(BaseModel):
    id_grupo: int | None = None
    matricula: str | None = Field(default=None, max_length=20)
    nombre: str | None = Field(default=None, max_length=80)
    apellido_paterno: str | None = Field(default=None, max_length=60)
    apellido_materno: str | None = Field(default=None, max_length=60)
    fecha_nacimiento: date | None = None
    sexo: str | None = Field(default=None, max_length=1)
    email: str | None = Field(default=None, max_length=100)
    telefono_personal: str | None = Field(default=None, max_length=20)
    estatus: str | None = Field(default=None, max_length=20)
    fecha_baja: date | None = None
    municipio_origen: str | None = Field(default=None, max_length=100)
    localidad_origen: str | None = Field(default=None, max_length=100)


class AlumnoInscribir(BaseModel):
    id_grupo: int


class ExpedienteAcademicoBase(BaseModel):
    escuela_procedencia: str | None = Field(default=None, max_length=200)
    promedio_secundaria: float | None = None
    promedio_actual: float | None = None
    situacion_academica: SituacionAcademica = "regular"


class ExpedienteAcademicoCreate(ExpedienteAcademicoBase):
    id_alumno: int


class ExpedienteAcademicoOut(ExpedienteAcademicoBase):
    model_config = ConfigDict(from_attributes=True)

    id_exp_academico: int
    id_alumno: int


class ExpedienteAcademicoUpdate(BaseModel):
    escuela_procedencia: str | None = Field(default=None, max_length=200)
    promedio_secundaria: float | None = None
    promedio_actual: float | None = None
    situacion_academica: SituacionAcademica | None = None


# ADR-010: campos mínimos de identificación devueltos por
# fn_alumno_buscar_docente -- deliberadamente más acotado que
# AlumnoOutDocente (sin curp/fecha_nacimiento/etc.), ya que esta búsqueda
# opera fuera del scope normal de Alumno para un docente.
class AlumnoBusquedaDocenteOut(BaseModel):
    id_alumno: int
    matricula: str
    nombre: str
    apellido_paterno: str
    apellido_materno: str | None
