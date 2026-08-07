from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

NumeroPeriodo = Literal[1, 2]


class PlantelBase(BaseModel):
    clave_plantel: str = Field(max_length=20)
    nombre_plantel: str = Field(max_length=200)
    municipio: str = Field(max_length=100)
    estado: str = Field(max_length=80)
    domicilio: str | None = Field(default=None, max_length=300)
    telefono: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=100)


class PlantelCreate(PlantelBase):
    pass


class PlantelOut(PlantelBase):
    model_config = ConfigDict(from_attributes=True)

    id_plantel: int
    estatus: str


class PlantelUpdate(BaseModel):
    """Edición parcial del plantel único del MVP — solo se actualizan los
    campos enviados (exclude_unset en el service). Sin id_plantel: es el
    único row (docs/data_dictionary/mvp.md #1), no hay ambigüedad de cuál
    editar."""

    clave_plantel: str | None = Field(default=None, max_length=20)
    nombre_plantel: str | None = Field(default=None, max_length=200)
    municipio: str | None = Field(default=None, max_length=100)
    estado: str | None = Field(default=None, max_length=80)
    domicilio: str | None = Field(default=None, max_length=300)
    telefono: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=100)
    estatus: str | None = Field(default=None, max_length=20)


class CicloEscolarBase(BaseModel):
    nombre: str = Field(max_length=20)
    fecha_inicio: date
    fecha_fin: date


class CicloEscolarCreate(CicloEscolarBase):
    activo: bool = False


class CicloEscolarOut(CicloEscolarBase):
    model_config = ConfigDict(from_attributes=True)

    id_ciclo: int
    activo: bool


class PeriodoSemestralBase(BaseModel):
    id_ciclo: int
    clave_periodo: str = Field(max_length=10)
    numero_periodo: NumeroPeriodo
    fecha_inicio: date
    fecha_fin: date


class PeriodoSemestralCreate(PeriodoSemestralBase):
    activo: bool = False


class PeriodoSemestralOut(PeriodoSemestralBase):
    model_config = ConfigDict(from_attributes=True)

    id_periodo: int
    activo: bool


class PeriodoSemestralUpdate(BaseModel):
    """Activar/desactivar únicamente — es lo único que se necesita hoy.
    Editar fechas/clave/id_ciclo no está pedido; si hace falta después,
    este schema crece cuando ese caso exista."""

    activo: bool
