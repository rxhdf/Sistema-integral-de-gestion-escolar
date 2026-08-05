"""Tests de autorización explícitos contra la matriz RBAC
(docs/rbac/matriz-rbac-mvp.md) para organizacional/ y personal/ — no solo
CRUD feliz: cada regla de "quién puede qué" se prueba tanto en el caso que
debe fallar (403/401) como en el que debe pasar.
"""

from tests.conftest import (
    PASSWORD_ADMIN,
    PASSWORD_DIRECTIVO,
    PASSWORD_DOCENTE,
    PASSWORD_DOCENTE_BAJA,
    auth_headers,
)


# --- /auth/login ------------------------------------------------------


def test_login_wrong_password_401(client, seed):
    resp = client.post(
        "/auth/login",
        json={"email_institucional": "docente1@sige.test", "password": "wrong"},
    )
    assert resp.status_code == 401


def test_login_unknown_email_401(client, seed):
    resp = client.post(
        "/auth/login",
        json={"email_institucional": "nadie@sige.test", "password": "whatever123"},
    )
    assert resp.status_code == 401


def test_login_baja_personal_cannot_authenticate_401(client, seed):
    """fn_login_lookup (ADR-007) filtra estatus = 'activo' — un personal
    dado de baja no puede autenticarse aunque conozca su password."""
    resp = client.post(
        "/auth/login",
        json={
            "email_institucional": "docente.baja@sige.test",
            "password": PASSWORD_DOCENTE_BAJA,
        },
    )
    assert resp.status_code == 401


def test_login_valid_credentials_200(client, seed):
    resp = client.post(
        "/auth/login",
        json={"email_institucional": "admin1@sige.test", "password": PASSWORD_ADMIN},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


# --- 401 antes de tocar la BD: falta o token inválido ------------------


def test_protected_endpoint_without_token_401(client, seed):
    resp = client.get("/personal/me")
    assert resp.status_code == 401


def test_protected_endpoint_garbage_token_401(client, seed):
    resp = client.get("/personal/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401


# --- Personal: ADR-003 / matriz Nivel 1 — solo admin C, D --------------


def test_personal_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/personal",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "curp": "CURPNUEVO000000001",
            "nombre": "Nuevo",
            "apellido_paterno": "Apellido",
            "email_institucional": "nuevo1@sige.test",
            "rol": "docente",
            "password": "nuevo-pass-1",
        },
    )
    assert resp.status_code == 403


def test_personal_create_directivo_forbidden_403(client, seed):
    """Directivo lee todo el plantel pero NO crea/edita/da de baja Personal
    — esa es la única diferencia con admin (ADR-003)."""
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.post(
        "/personal",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "curp": "CURPNUEVO000000002",
            "nombre": "Nuevo",
            "apellido_paterno": "Apellido",
            "email_institucional": "nuevo2@sige.test",
            "rol": "docente",
            "password": "nuevo-pass-1",
        },
    )
    assert resp.status_code == 403


def test_personal_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.post(
        "/personal",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "curp": "CURPNUEVO000000003",
            "nombre": "Nuevo",
            "apellido_paterno": "Apellido",
            "email_institucional": "nuevo3@sige.test",
            "rol": "docente",
            "password": "nuevo-pass-1",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email_institucional"] == "nuevo3@sige.test"
    assert "password" not in body
    assert "password_hash" not in body


def test_personal_list_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/personal", headers=headers)
    assert resp.status_code == 403


def test_personal_list_directivo_sees_all_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/personal", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == len(seed["ids"])


def test_personal_list_admin_sees_all_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/personal", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == len(seed["ids"])


def test_personal_me_returns_own_record_for_every_role(client, seed):
    for email, password in (
        ("docente1@sige.test", PASSWORD_DOCENTE),
        ("directivo1@sige.test", PASSWORD_DIRECTIVO),
        ("admin1@sige.test", PASSWORD_ADMIN),
    ):
        headers = auth_headers(client, email, password)
        resp = client.get("/personal/me", headers=headers)
        assert resp.status_code == 200, resp.text
        assert resp.json()["email_institucional"] == email
        assert "password_hash" not in resp.json()


# --- Organizacional: Plantel — matriz Nivel 1 no otorga Create a nadie -


def test_plantel_get_allowed_for_docente_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/plantel", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_plantel_post_does_not_exist_405(client, seed):
    """La matriz RBAC no otorga Create de Plantel a ningún rol (una sola
    fila en el MVP) — no existe la ruta, ni siquiera para admin."""
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.post("/plantel", headers=headers, json={})
    assert resp.status_code == 405


# --- Organizacional: Ciclo_Escolar — directivo/admin C,R,U; docente R --


def test_ciclo_escolar_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/ciclo-escolar",
        headers=headers,
        json={"nombre": "2030-2031", "fecha_inicio": "2030-08-01", "fecha_fin": "2031-07-31"},
    )
    assert resp.status_code == 403


def test_ciclo_escolar_create_directivo_created_201(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.post(
        "/ciclo-escolar",
        headers=headers,
        json={"nombre": "2027-2028", "fecha_inicio": "2027-08-01", "fecha_fin": "2028-07-31"},
    )
    assert resp.status_code == 201, resp.text


def test_ciclo_escolar_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.post(
        "/ciclo-escolar",
        headers=headers,
        json={"nombre": "2028-2029", "fecha_inicio": "2028-08-01", "fecha_fin": "2029-07-31"},
    )
    assert resp.status_code == 201, resp.text


def test_ciclo_escolar_get_allowed_for_docente_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/ciclo-escolar", headers=headers)
    assert resp.status_code == 200


# --- Organizacional: Periodo_Semestral — directivo/admin C,R,U; docente R


def test_periodo_semestral_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/periodo-semestral",
        headers=headers,
        json={
            "id_ciclo": seed["id_ciclo"],
            "clave_periodo": "2026B",
            "numero_periodo": 2,
            "fecha_inicio": "2027-02-01",
            "fecha_fin": "2027-07-31",
        },
    )
    assert resp.status_code == 403


def test_periodo_semestral_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.post(
        "/periodo-semestral",
        headers=headers,
        json={
            "id_ciclo": seed["id_ciclo"],
            "clave_periodo": "2026B",
            "numero_periodo": 2,
            "fecha_inicio": "2027-02-01",
            "fecha_fin": "2027-07-31",
        },
    )
    assert resp.status_code == 201, resp.text
