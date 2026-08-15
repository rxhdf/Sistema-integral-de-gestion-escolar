from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ReporteIncidenciaCreate(BaseModel):
    id_alumno: int
    fecha_incidente: date
    descripcion: str = Field(min_length=1)


class ReporteIncidenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_reporte_incidencia: int
    id_alumno: int
    id_personal_reporta: int
    fecha_incidente: date
    descripcion: str
    fecha_registro: datetime
