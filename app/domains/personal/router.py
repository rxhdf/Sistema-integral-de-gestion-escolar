from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    CurrentPersonal,
    authenticate_personal,
    create_access_token,
    get_current_personal,
    require_roles,
)
from app.db.session import get_db
from app.domains.personal import service
from app.domains.personal.schemas import (
    LoginRequest,
    PersonalCreate,
    PersonalOut,
    PersonalOutSelf,
    PersonalUpdate,
    TokenResponse,
)

router = APIRouter()
auth_router = APIRouter(prefix="/auth")


@auth_router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    result = authenticate_personal(db, payload.email_institucional, payload.password)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    token = create_access_token(result.id_personal, result.rol)
    return TokenResponse(access_token=token)


# ADR-003 / matriz RBAC Nivel 1: solo admin crea/edita/da de baja Personal
# (directivo solo lee).
@router.post("/personal", response_model=PersonalOut, status_code=status.HTTP_201_CREATED)
def post_personal(
    payload: PersonalCreate,
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(require_roles("admin")),
) -> PersonalOut:
    try:
        return service.create_personal(db, payload)
    except service.ValorDuplicadoError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.get("/personal", response_model=list[PersonalOut])
def get_personal(
    db: Session = Depends(get_db),
    _current: CurrentPersonal = Depends(require_roles("directivo", "admin")),
) -> list[PersonalOut]:
    return service.list_personal(db)


@router.get("/personal/me", response_model=PersonalOutSelf)
def get_personal_me(
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(get_current_personal),
) -> PersonalOutSelf:
    personal = service.get_self(db, current.id_personal)
    if personal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro no encontrado")
    return personal


@router.put("/personal/{id_personal}", response_model=PersonalOut)
def put_personal(
    id_personal: int,
    payload: PersonalUpdate,
    db: Session = Depends(get_db),
    current: CurrentPersonal = Depends(require_roles("admin")),
) -> PersonalOut:
    try:
        personal = service.update_personal(db, current, id_personal, payload)
    except service.LastActiveAdminError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    if personal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro no encontrado")
    return personal
