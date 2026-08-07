from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TipoEvaluacion = Literal["ordinaria", "extraordinaria"]


class CalificacionCreate(BaseModel):
    id_alumno: int
    id_grupo_asig: int
    parcial_1: float | None = Field(default=None, ge=0, le=10)
    parcial_2: float | None = Field(default=None, ge=0, le=10)
    parcial_3: float | None = Field(default=None, ge=0, le=10)
    tipo_evaluacion: TipoEvaluacion = "ordinaria"


class CalificacionUpdate(BaseModel):
    parcial_1: float | None = Field(default=None, ge=0, le=10)
    parcial_2: float | None = Field(default=None, ge=0, le=10)
    parcial_3: float | None = Field(default=None, ge=0, le=10)
    tipo_evaluacion: TipoEvaluacion | None = None


class CalificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_calificacion: int
    id_alumno: int
    id_grupo_asig: int
    parcial_1: float | None
    parcial_2: float | None
    parcial_3: float | None
    calificacion_final: float | None
    tipo_evaluacion: str
    estatus: str
    fecha_captura: datetime


class AuditoriaCalificacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_auditoria: int
    id_calificacion: int
    id_personal_capturo: int | None
    id_personal_modifico: int | None
    accion: str
    valores_anteriores: dict | None
    valores_nuevos: dict | None
    fecha_evento: datetime
