from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Semestre = Literal[1, 2, 3, 4, 5, 6]


class GrupoBase(BaseModel):
    id_plantel: int
    id_periodo: int
    semestre: Semestre
    nombre_grupo: str = Field(max_length=10)
    capacidad_maxima: int | None = None


class GrupoCreate(GrupoBase):
    pass


class GrupoOut(GrupoBase):
    model_config = ConfigDict(from_attributes=True)

    id_grupo: int


class GrupoUpdate(BaseModel):
    id_periodo: int | None = None
    semestre: Semestre | None = None
    nombre_grupo: str | None = Field(default=None, max_length=10)
    capacidad_maxima: int | None = None


class AsignaturaBase(BaseModel):
    clave_asignatura: str = Field(max_length=20)
    nombre: str = Field(max_length=120)
    semestre: Semestre


class AsignaturaCreate(AsignaturaBase):
    activa: bool = True


class AsignaturaOut(AsignaturaBase):
    model_config = ConfigDict(from_attributes=True)

    id_asignatura: int
    activa: bool


class AsignaturaUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=120)
    semestre: Semestre | None = None
    activa: bool | None = None


class GrupoAsignaturaBase(BaseModel):
    id_grupo: int
    id_asignatura: int
    id_docente: int
    id_periodo: int


class GrupoAsignaturaCreate(GrupoAsignaturaBase):
    pass


class GrupoAsignaturaOut(GrupoAsignaturaBase):
    model_config = ConfigDict(from_attributes=True)

    id_grupo_asig: int


class GrupoAsignaturaUpdate(BaseModel):
    id_docente: int | None = None
    id_periodo: int | None = None
