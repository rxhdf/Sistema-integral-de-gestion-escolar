from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LogAccesoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_log: int
    email_intentado: str
    id_personal: int | None
    exitoso: bool
    motivo_fallo: str | None
    fecha_intento: datetime
