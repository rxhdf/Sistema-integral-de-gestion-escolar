import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET_KEY
from app.db.session import get_db

logger = logging.getLogger(__name__)

Rol = Literal["docente", "directivo", "admin"]

# auto_error=False: queremos decidir nosotros el 401 (ver get_current_personal)
# en vez del 403 por defecto que FastAPI da cuando falta el header.
_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(id_personal: int, rol: Rol) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(id_personal),
        "rol": rol,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


@dataclass(frozen=True)
class LoginResult:
    id_personal: int
    rol: Rol


def authenticate_personal(db: Session, email: str, password: str) -> LoginResult | None:
    """Verifica email+password contra fn_login_lookup (ADR-007).

    Se usa la función SECURITY DEFINER porque en este punto todavía no
    existe JWT ni sesión: RLS de `personal` denegaría la lectura por email
    (nadie hizo SET app.current_rol / app.current_personal_id todavía —
    ver ADR-007). fn_login_lookup ya filtra estatus = 'activo' internamente,
    así que un personal dado de baja nunca llega aquí con fila.
    """
    row = (
        db.execute(text("SELECT * FROM fn_login_lookup(:email)"), {"email": email})
        .mappings()
        .first()
    )
    if row is None:
        return None
    if not verify_password(password, row["password_hash"]):
        return None
    return LoginResult(id_personal=row["id_personal"], rol=row["rol"])


@dataclass(frozen=True)
class CurrentPersonal:
    id_personal: int
    rol: Rol


def get_current_personal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentPersonal:
    """Decodifica el JWT y, solo si es válido, fija la identidad de sesión
    en Postgres para que RLS la use (ADR-006).

    JWT ausente o inválido -> 401 antes de tocar la BD (el `db.execute`
    de abajo es inalcanzable en ese caso).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta token de autenticación",
        )

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        id_personal = int(payload["sub"])
        rol = payload["rol"]
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    # set_config(..., is_local=true): efecto acotado a la transacción de
    # este request, no al ciclo de vida de la conexión física. Con pool de
    # conexiones, un SET de sesión (is_local=false) sobreviviría al
    # rollback/checkin y podría filtrarse a otro request que reutilice la
    # misma conexión — SET LOCAL se limpia solo en cada commit/rollback.
    db.execute(text("SELECT set_config('app.current_rol', :rol, true)"), {"rol": rol})
    db.execute(
        text("SELECT set_config('app.current_personal_id', :id, true)"),
        {"id": str(id_personal)},
    )
    return CurrentPersonal(id_personal=id_personal, rol=rol)


def require_roles(*roles: Rol):
    def checker(current: CurrentPersonal = Depends(get_current_personal)) -> CurrentPersonal:
        if current.rol not in roles:
            logger.warning(
                "Acceso denegado: id_personal=%s rol=%s intentó una operación que requiere %s",
                current.id_personal,
                current.rol,
                roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado para esta operación",
            )
        return current

    return checker
