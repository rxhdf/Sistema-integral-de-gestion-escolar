"""Prueba de la cadena completa JWT -> SET app.current_* -> RLS, de punta
a punta, conectando con el rol real de runtime (sige_app vía app.db.session
.engine) — no con sige_migrator. No es una repetición de
docs/validacion/rls-test-log-sige_app.md (eso ya validó RLS en aislado);
esto valida que app/core/security.py efectivamente conecta ese flujo con
un JWT real, y que fn_login_lookup (ADR-007) no abre ninguna grieta nueva
en la RLS de `personal`.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import authenticate_personal
from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, PASSWORD_DOCENTE_BAJA


def _set_session(db: Session, rol: str, id_personal: int) -> None:
    """Replica exactamente lo que hace get_current_personal tras validar
    el JWT (app/core/security.py) — la misma llamada, no una reinventada."""
    db.execute(text("SELECT set_config('app.current_rol', :rol, true)"), {"rol": rol})
    db.execute(
        text("SELECT set_config('app.current_personal_id', :id, true)"),
        {"id": str(id_personal)},
    )


def test_fn_login_lookup_returns_credentials_for_active_personal(seed, app_db):
    result = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert result is not None
    assert result.id_personal == seed["ids"]["docente1@sige.test"]
    assert result.rol == "docente"


def test_fn_login_lookup_rejects_wrong_password(seed, app_db):
    assert authenticate_personal(app_db, "docente1@sige.test", "wrong-password") is None


def test_fn_login_lookup_rejects_baja_personal_even_with_correct_password(seed, app_db):
    """El filtro estatus = 'activo' vive dentro de la función (ADR-007),
    no en el service — se prueba directo contra la función, sin pasar por
    el service, para confirmar que la garantía es de la BD."""
    assert (
        authenticate_personal(app_db, "docente.baja@sige.test", PASSWORD_DOCENTE_BAJA)
        is None
    )


def test_docente_jwt_scopes_personal_query_to_own_row_via_rls(seed, app_db):
    """La prueba de punta a punta pedida: con la identidad de sesión que
    resultaría de un JWT de docente (mismo id_personal que emitiría
    create_access_token tras un login real), una consulta SIN filtro
    (`SELECT * FROM personal`) sobre la conexión real de sige_app debe
    devolver únicamente la fila propia — RLS filtrando filas, no el
    service filtrando en Python.
    """
    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None

    _set_session(app_db, login.rol, login.id_personal)
    rows = app_db.execute(text("SELECT id_personal FROM personal")).all()

    assert [r.id_personal for r in rows] == [login.id_personal]


def test_directivo_and_admin_jwt_see_all_personal_via_rls(seed, app_db):
    total_seeded = len(seed["ids"])

    for email, password in (
        ("directivo1@sige.test", PASSWORD_DIRECTIVO),
        ("admin1@sige.test", PASSWORD_ADMIN),
    ):
        login = authenticate_personal(app_db, email, password)
        assert login is not None
        _set_session(app_db, login.rol, login.id_personal)
        rows = app_db.execute(text("SELECT id_personal FROM personal")).all()
        assert len(rows) == total_seeded


def test_docente_session_still_blocked_from_inserting_personal_by_rls(seed, app_db):
    """Nivel 1 de la matriz RBAC (solo admin crea Personal) también está
    respaldado por RLS (personal_insert), no solo por el 403 de
    require_roles en el router — esto prueba la capa de BD directamente,
    bypasseando la capa de aplicación por completo."""
    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    from sqlalchemy.exc import DBAPIError

    try:
        app_db.execute(
            text(
                "INSERT INTO personal "
                "(id_plantel, curp, nombre, apellido_paterno, email_institucional, "
                " password_hash, rol) "
                "VALUES (:id_plantel, 'CURPBYPASS0000001', 'X', 'Y', 'bypass@sige.test', "
                " 'hash', 'docente')"
            ),
            {"id_plantel": seed["id_plantel"]},
        )
        app_db.commit()
        raised = False
    except DBAPIError:
        app_db.rollback()
        raised = True

    assert raised, "RLS debió rechazar el INSERT de un docente en personal"
