from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RolPersonal = Literal["docente", "directivo", "admin"]


class PersonalBase(BaseModel):
    id_plantel: int
    curp: str = Field(min_length=18, max_length=18)
    nombre: str = Field(max_length=80)
    apellido_paterno: str = Field(max_length=60)
    apellido_materno: str | None = Field(default=None, max_length=60)
    email_institucional: str = Field(max_length=100)
    rol: RolPersonal
    telefono: str | None = Field(default=None, max_length=20)
    fecha_ingreso: date | None = None


class PersonalCreate(PersonalBase):
    # Contraseña en claro de entrada; el service la hashea (bcrypt, ver
    # app/core/security.py) antes de persistir. Nunca se guarda ni se
    # expone tal cual.
    password: str = Field(min_length=8)


class PersonalOut(PersonalBase):
    """Vista de admin/directivo: todos los campos salvo password_hash
    (matriz RBAC — nunca se expone a ningún rol vía API)."""

    model_config = ConfigDict(from_attributes=True)

    id_personal: int
    estatus: str


class PersonalOutSelf(PersonalOut):
    """Vista de un docente sobre su propio registro.

    Mismos campos que PersonalOut: la matriz RBAC (Nivel 3) confirma que un
    docente que lee su propio registro no tiene ocultamiento adicional de
    columnas. Se mantiene como clase separada porque es el punto de
    extensión si esa regla cambia — el filtrado por fila (RLS) ya garantiza
    que un docente solo llega a este schema con su propio id_personal.
    """


class PersonalUpdate(BaseModel):
    """Edición parcial: solo se actualizan los campos enviados
    (exclude_unset en el service). curp/email_institucional/id_plantel no
    son editables aquí — no fue pedido y cambiarlos tiene implicaciones de
    identidad/login que ameritan su propia discusión."""

    nombre: str | None = Field(default=None, max_length=80)
    apellido_paterno: str | None = Field(default=None, max_length=60)
    apellido_materno: str | None = Field(default=None, max_length=60)
    telefono: str | None = Field(default=None, max_length=20)
    fecha_ingreso: date | None = None
    rol: RolPersonal | None = None
    estatus: str | None = Field(default=None, max_length=20)


class LoginRequest(BaseModel):
    email_institucional: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
