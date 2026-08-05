"""Tests de autorización + reglas de negocio para los PUT agregados en el
cierre de Fase 2: PUT /periodo-semestral (activar/desactivar, respetando
el índice único parcial que garantiza un solo periodo activo) y
PUT /personal (editar datos/rol, solo admin, con el guard del único admin
activo de CLAUDE.md)."""

from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, auth_headers


def _seeded_periodo_id(client, headers) -> int:
    resp = client.get("/periodo-semestral", headers=headers)
    return resp.json()[0]["id_periodo"]


# --- PUT /periodo-semestral --------------------------------------------


def test_periodo_semestral_put_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    id_periodo = _seeded_periodo_id(client, headers)
    resp = client.put(f"/periodo-semestral/{id_periodo}", headers=headers, json={"activo": False})
    assert resp.status_code == 403


def test_periodo_semestral_put_directivo_can_deactivate_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    id_periodo = _seeded_periodo_id(client, headers)
    resp = client.put(f"/periodo-semestral/{id_periodo}", headers=headers, json={"activo": False})
    assert resp.status_code == 200, resp.text
    assert resp.json()["activo"] is False


def test_periodo_semestral_put_activating_deactivates_the_other_200(client, seed):
    """uq_periodo_semestral_activo: solo un periodo activo a la vez —
    activar uno nuevo debe desactivar el que ya estaba activo, en la misma
    llamada, sin violar el índice único parcial."""
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)

    create_resp = client.post(
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
    assert create_resp.status_code == 201, create_resp.text
    id_periodo_2 = create_resp.json()["id_periodo"]
    assert create_resp.json()["activo"] is False

    resp = client.put(f"/periodo-semestral/{id_periodo_2}", headers=headers, json={"activo": True})
    assert resp.status_code == 200, resp.text
    assert resp.json()["activo"] is True

    lista = client.get("/periodo-semestral", headers=headers).json()
    activos = [p for p in lista if p["activo"]]
    assert [p["id_periodo"] for p in activos] == [id_periodo_2]


def test_periodo_semestral_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/periodo-semestral/999999", headers=headers, json={"activo": True})
    assert resp.status_code == 404


# --- PUT /personal -------------------------------------------------------


def test_personal_put_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    target_id = seed["ids"]["docente1@sige.test"]
    resp = client.put(f"/personal/{target_id}", headers=headers, json={"telefono": "5555555555"})
    assert resp.status_code == 403


def test_personal_put_directivo_forbidden_403(client, seed):
    """Directivo lee todo el plantel pero no edita Personal (ADR-003) —
    misma regla que ya se probó para create, ahora para update."""
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    target_id = seed["ids"]["docente1@sige.test"]
    resp = client.put(f"/personal/{target_id}", headers=headers, json={"telefono": "5555555555"})
    assert resp.status_code == 403


def test_personal_put_admin_edits_data_and_role_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    target_id = seed["ids"]["docente1@sige.test"]
    resp = client.put(
        f"/personal/{target_id}",
        headers=headers,
        json={"telefono": "5555555555", "rol": "directivo"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["telefono"] == "5555555555"
    assert body["rol"] == "directivo"


def test_personal_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/personal/999999", headers=headers, json={"telefono": "1"})
    assert resp.status_code == 404


def test_personal_put_sole_active_admin_cannot_demote_self_409(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    admin_id = seed["ids"]["admin1@sige.test"]
    resp = client.put(f"/personal/{admin_id}", headers=headers, json={"rol": "directivo"})
    assert resp.status_code == 409


def test_personal_put_sole_active_admin_cannot_deactivate_self_409(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    admin_id = seed["ids"]["admin1@sige.test"]
    resp = client.put(f"/personal/{admin_id}", headers=headers, json={"estatus": "baja"})
    assert resp.status_code == 409


def test_personal_put_admin_editing_someone_else_not_blocked_by_guard_200(client, seed):
    """El guard es solo para auto-edición — admin sí puede cambiar el rol
    de otro personal (incluso a/desde admin) sin restricción."""
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    directivo_id = seed["ids"]["directivo1@sige.test"]
    resp = client.put(f"/personal/{directivo_id}", headers=headers, json={"rol": "admin"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["rol"] == "admin"


def test_personal_put_admin_can_demote_self_if_another_active_admin_exists_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    create_resp = client.post(
        "/personal",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "curp": "CURPADMIN000000002",
            "nombre": "Admin",
            "apellido_paterno": "Dos",
            "email_institucional": "admin2@sige.test",
            "rol": "admin",
            "password": "admin2-pass-1",
        },
    )
    assert create_resp.status_code == 201, create_resp.text

    admin_id = seed["ids"]["admin1@sige.test"]
    resp = client.put(f"/personal/{admin_id}", headers=headers, json={"rol": "directivo"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["rol"] == "directivo"
