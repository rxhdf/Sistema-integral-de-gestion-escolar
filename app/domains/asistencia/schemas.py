from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

EstadoAsistencia = Literal["presente", "ausente", "retardo"]


class AsistenciaRegistroLote(BaseModel):
    id_alumno: int
    estado: EstadoAsistencia


class AsistenciaLoteCreate(BaseModel):
    id_grupo_asig: int
    fecha_sesion: date
    registros: list[AsistenciaRegistroLote]

    @field_validator("registros")
    @classmethod
    def _sin_alumnos_duplicados(
        cls, registros: list[AsistenciaRegistroLote]
    ) -> list[AsistenciaRegistroLote]:
        # El UPSERT (ON CONFLICT DO UPDATE) inserta el lote completo en una
        # sola sentencia multi-fila -- dos filas con el mismo id_alumno
        # dentro del mismo lote chocan entre sí ("ON CONFLICT DO UPDATE
        # command cannot affect row a second time"), un 500 críptico en
        # vez de un 422 claro. Se valida aquí, antes de llegar a Postgres.
        vistos = {r.id_alumno for r in registros}
        if len(vistos) != len(registros):
            raise ValueError("No puede haber id_alumno repetido dentro del mismo lote")
        return registros


class AsistenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_asistencia: int
    id_alumno: int
    id_grupo_asig: int
    fecha_sesion: date
    estado: str
    id_personal_registro: int
    fecha_captura: datetime


# Agregado calculado al vuelo (docs/data_dictionary/asistencia.md,
# "Decisiones resueltas" #2) -- nunca persistido, para no desincronizarse
# del dato real. Mismo criterio ya aplicado a Grupo.num_alumnos_inscritos
# y Plantel.matricula_total.
class AsistenciaResumenOut(BaseModel):
    id_alumno: int
    presente: int
    ausente: int
    retardo: int
    total: int
