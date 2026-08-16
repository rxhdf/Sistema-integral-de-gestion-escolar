"""Tests de Gestión de Cuentas (docs/data_dictionary/gestion-cuentas.md):
reseteo de contraseña por admin (Pieza 1), bloqueo temporal de cuenta
(Pieza 2), y log de accesos (Pieza 3, ADR-011).
"""

import os

from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import sessionmaker

from tests.conftest import (
    PASSWORD_ADMIN,
    PASSWORD_DIRECTIVO,
    PASSWORD_DOCENTE,
    PASSWORD_DOCENTE_BAJA,
    auth_headers,
)

EMAIL_DOCENTE = "docente1@sige.test"
EMAIL_DOCENTE_BAJA = "docente.baja@sige.test"
EMAIL_DIRECTIVO = "directivo1@sige.test"
EMAIL_ADMIN = "admin1@sige.test"


# ---------------------------------------------------------------------
# Pieza 1 -- reseteo de contraseña
# ---------------------------------------------------------------------


def test_admin_resetea_password_y_docente_puede_loguearse_con_la_nueva(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    id_docente = seed["ids"][EMAIL_DOCENTE]

    resp = client.put(
        f"/personal/{id_docente}/reset-password",
        headers=admin_headers,
        json={"nueva_password": "nueva-pass-123"},
    )
    assert resp.status_code == 200, resp.text

    old_login = client.post(
        "/auth/login",
        json={"email_institucional": EMAIL_DOCENTE, "password": PASSWORD_DOCENTE},
    )
    assert old_login.status_code == 401, old_login.text

    new_login = client.post(
        "/auth/login",
        json={"email_institucional": EMAIL_DOCENTE, "password": "nueva-pass-123"},
    )
    assert new_login.status_code == 200, new_login.text


def test_reset_password_directivo_forbidden_403(client, seed):
    directivo_headers = auth_headers(client, EMAIL_DIRECTIVO, PASSWORD_DIRECTIVO)
    id_docente = seed["ids"][EMAIL_DOCENTE]
    resp = client.put(
        f"/personal/{id_docente}/reset-password",
        headers=directivo_headers,
        json={"nueva_password": "nueva-pass-123"},
    )
    assert resp.status_code == 403, resp.text


def test_reset_password_personal_inexistente_404(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    resp = client.put(
        "/personal/999999/reset-password",
        headers=admin_headers,
        json={"nueva_password": "nueva-pass-123"},
    )
    assert resp.status_code == 404, resp.text


def test_reset_password_corta_422(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    id_docente = seed["ids"][EMAIL_DOCENTE]
    resp = client.put(
        f"/personal/{id_docente}/reset-password",
        headers=admin_headers,
        json={"nueva_password": "corta"},
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------
# Pieza 2 -- bloqueo temporal
# ---------------------------------------------------------------------


def test_admin_bloquea_cuenta_y_login_queda_rechazado(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    id_docente = seed["ids"][EMAIL_DOCENTE]

    resp = client.put(
        f"/personal/{id_docente}", headers=admin_headers, json={"estatus": "bloqueado"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estatus"] == "bloqueado"

    login = client.post(
        "/auth/login",
        json={"email_institucional": EMAIL_DOCENTE, "password": PASSWORD_DOCENTE},
    )
    assert login.status_code == 401, login.text


def test_estatus_invalido_422(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    id_docente = seed["ids"][EMAIL_DOCENTE]
    resp = client.put(
        f"/personal/{id_docente}", headers=admin_headers, json={"estatus": "vacaciones"}
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------
# Pieza 3 -- log de accesos
# ---------------------------------------------------------------------


def test_log_registra_exito_y_fallos_con_motivo_correcto(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    id_docente = seed["ids"][EMAIL_DOCENTE]
    id_docente_baja = seed["ids"][EMAIL_DOCENTE_BAJA]

    ok = client.post(
        "/auth/login",
        json={"email_institucional": EMAIL_DOCENTE, "password": PASSWORD_DOCENTE},
    )
    assert ok.status_code == 200, ok.text

    bad_pw = client.post(
        "/auth/login", json={"email_institucional": EMAIL_DOCENTE, "password": "incorrecta"}
    )
    assert bad_pw.status_code == 401, bad_pw.text

    bad_email = client.post(
        "/auth/login",
        json={"email_institucional": "nadie@sige.test", "password": "lo-que-sea"},
    )
    assert bad_email.status_code == 401, bad_email.text

    baja = client.post(
        "/auth/login",
        json={"email_institucional": EMAIL_DOCENTE_BAJA, "password": PASSWORD_DOCENTE_BAJA},
    )
    assert baja.status_code == 401, baja.text

    client.put(f"/personal/{id_docente}", headers=admin_headers, json={"estatus": "bloqueado"})
    bloqueada = client.post(
        "/auth/login",
        json={"email_institucional": EMAIL_DOCENTE, "password": PASSWORD_DOCENTE},
    )
    assert bloqueada.status_code == 401, bloqueada.text

    # Historial del docente bloqueado, más reciente primero: bloqueada,
    # password incorrecta (mientras seguía activo), éxito original.
    resp_docente = client.get(
        "/log-acceso", headers=admin_headers, params={"id_personal": id_docente}
    )
    assert resp_docente.status_code == 200, resp_docente.text
    filas_docente = resp_docente.json()
    assert [f["motivo_fallo"] for f in filas_docente[:3]] == [
        "cuenta_bloqueada",
        "credenciales_invalidas",
        None,
    ]
    assert [f["exitoso"] for f in filas_docente[:3]] == [False, False, True]
    assert all(f["id_personal"] == id_docente for f in filas_docente[:3])

    resp_baja = client.get(
        "/log-acceso", headers=admin_headers, params={"id_personal": id_docente_baja}
    )
    assert resp_baja.status_code == 200, resp_baja.text
    assert resp_baja.json()[0]["motivo_fallo"] == "cuenta_baja"

    resp_all = client.get("/log-acceso", headers=admin_headers, params={"limit": 200})
    assert resp_all.status_code == 200, resp_all.text
    filas_inexistente = [
        f for f in resp_all.json() if f["email_intentado"] == "nadie@sige.test"
    ]
    assert len(filas_inexistente) == 1
    assert filas_inexistente[0]["motivo_fallo"] == "credenciales_invalidas"
    assert filas_inexistente[0]["id_personal"] is None


def test_docente_directivo_no_leen_log_acceso_403(client, seed):
    docente_headers = auth_headers(client, EMAIL_DOCENTE, PASSWORD_DOCENTE)
    resp = client.get("/log-acceso", headers=docente_headers)
    assert resp.status_code == 403, resp.text

    directivo_headers = auth_headers(client, EMAIL_DIRECTIVO, PASSWORD_DIRECTIVO)
    resp2 = client.get("/log-acceso", headers=directivo_headers)
    assert resp2.status_code == 403, resp2.text


def test_log_acceso_sin_endpoint_put_delete_405(client, seed):
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    put_resp = client.put("/log-acceso", headers=admin_headers, json={})
    assert put_resp.status_code == 405, put_resp.text
    delete_resp = client.delete("/log-acceso", headers=admin_headers)
    assert delete_resp.status_code == 405, delete_resp.text


def test_log_acceso_update_delete_insert_directo_bloqueado_por_rls(client, seed):
    # Defensa en profundidad: ni siquiera admin puede escribir directo a
    # la tabla -- el único camino de escritura es fn_registrar_intento_login
    # (SECURITY DEFINER, ADR-011), no un GRANT de sige_app. Mismo rigor que
    # auditoria_calificacion (Fase 5) y reporte_incidencia (ADR-010).
    admin_headers = auth_headers(client, EMAIL_ADMIN, PASSWORD_ADMIN)
    id_admin = seed["ids"][EMAIL_ADMIN]

    client.post(
        "/auth/login", json={"email_institucional": EMAIL_ADMIN, "password": PASSWORD_ADMIN}
    )
    resp = client.get("/log-acceso", headers=admin_headers, params={"limit": 1})
    id_log = resp.json()[0]["id_log"]

    app_engine = create_engine(os.environ["DATABASE_URL"])
    AppSession = sessionmaker(bind=app_engine)
    with AppSession() as db:
        db.execute(text("SELECT set_config('app.current_rol', 'admin', true)"))
        db.execute(
            text("SELECT set_config('app.current_personal_id', :id, true)"),
            {"id": str(id_admin)},
        )

        result = db.execute(
            text("UPDATE log_acceso SET motivo_fallo = 'hackeado' WHERE id_log = :id"),
            {"id": id_log},
        )
        assert result.rowcount == 0

        result = db.execute(
            text("DELETE FROM log_acceso WHERE id_log = :id"), {"id": id_log}
        )
        assert result.rowcount == 0
        db.commit()

    with AppSession() as db:
        db.execute(text("SELECT set_config('app.current_rol', 'admin', true)"))
        db.execute(
            text("SELECT set_config('app.current_personal_id', :id, true)"),
            {"id": str(id_admin)},
        )
        try:
            db.execute(
                text(
                    "INSERT INTO log_acceso (email_intentado, exitoso) "
                    "VALUES ('direct@sige.test', true)"
                )
            )
            db.rollback()
            raise AssertionError("INSERT directo a log_acceso debería estar bloqueado por RLS")
        except ProgrammingError:
            db.rollback()
