"""Traducción de violaciones de constraint a 4xx claros en
POST /ciclo-escolar y POST /periodo-semestral -- antes de esta corrección
las 3 (ciclo) / 4 (periodo) violaciones listadas en
docs/frontend/02-especificacion-contenido.md llegaban como 500 crudo de
Postgres. `seed` (tests/conftest.py) ya deja un ciclo_escolar activo
('2026-2027') y un periodo_semestral activo ('2026A', numero_periodo=1)
para poder disparar los casos de "ya hay uno activo" / duplicado sin setup
adicional."""

from tests.conftest import PASSWORD_DIRECTIVO, auth_headers


def _headers(client):
    return auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)


# --- POST /ciclo-escolar --------------------------------------------------


def test_post_ciclo_escolar_fechas_invalidas_422(client, seed):
    resp = client.post(
        "/ciclo-escolar",
        headers=_headers(client),
        json={"nombre": "2027-2028", "fecha_inicio": "2027-08-01", "fecha_fin": "2027-01-01"},
    )
    assert resp.status_code == 422, resp.text
    assert "fecha" in resp.json()["detail"].lower()


def test_post_ciclo_escolar_nombre_duplicado_409(client, seed):
    resp = client.post(
        "/ciclo-escolar",
        headers=_headers(client),
        json={"nombre": "2026-2027", "fecha_inicio": "2028-08-01", "fecha_fin": "2029-07-31"},
    )
    assert resp.status_code == 409, resp.text
    assert "nombre" in resp.json()["detail"].lower()


def test_post_ciclo_escolar_ya_hay_activo_409(client, seed):
    resp = client.post(
        "/ciclo-escolar",
        headers=_headers(client),
        json={
            "nombre": "2028-2029",
            "fecha_inicio": "2028-08-01",
            "fecha_fin": "2029-07-31",
            "activo": True,
        },
    )
    assert resp.status_code == 409, resp.text
    assert "activo" in resp.json()["detail"].lower()


# --- POST /periodo-semestral ----------------------------------------------


def test_post_periodo_semestral_fechas_invalidas_422(client, seed):
    resp = client.post(
        "/periodo-semestral",
        headers=_headers(client),
        json={
            "id_ciclo": seed["id_ciclo"],
            "clave_periodo": "2026B",
            "numero_periodo": 2,
            "fecha_inicio": "2027-02-01",
            "fecha_fin": "2026-08-01",
        },
    )
    assert resp.status_code == 422, resp.text
    assert "fecha" in resp.json()["detail"].lower()


def test_post_periodo_semestral_clave_duplicada_409(client, seed):
    resp = client.post(
        "/periodo-semestral",
        headers=_headers(client),
        json={
            "id_ciclo": seed["id_ciclo"],
            "clave_periodo": "2026A",
            "numero_periodo": 2,
            "fecha_inicio": "2027-02-01",
            "fecha_fin": "2027-07-31",
        },
    )
    assert resp.status_code == 409, resp.text
    assert "clave" in resp.json()["detail"].lower()


def test_post_periodo_semestral_numero_duplicado_para_mismo_ciclo_409(client, seed):
    resp = client.post(
        "/periodo-semestral",
        headers=_headers(client),
        json={
            "id_ciclo": seed["id_ciclo"],
            "clave_periodo": "2026C",
            "numero_periodo": 1,
            "fecha_inicio": "2027-02-01",
            "fecha_fin": "2027-07-31",
        },
    )
    assert resp.status_code == 409, resp.text


def test_post_periodo_semestral_ya_hay_activo_409(client, seed):
    resp = client.post(
        "/periodo-semestral",
        headers=_headers(client),
        json={
            "id_ciclo": seed["id_ciclo"],
            "clave_periodo": "2026B",
            "numero_periodo": 2,
            "fecha_inicio": "2027-02-01",
            "fecha_fin": "2027-07-31",
            "activo": True,
        },
    )
    assert resp.status_code == 409, resp.text
    assert "activo" in resp.json()["detail"].lower()
