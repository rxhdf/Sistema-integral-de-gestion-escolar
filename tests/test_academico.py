"""Tests de autorización + scope para Fase 3 (academico/): Grupo,
Asignatura, Grupo_Asignatura — mismo patrón que test_auth_rbac.py /
test_put_endpoints.py, contra la matriz RBAC (docs/rbac/matriz-rbac-mvp.md).
"""

from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, auth_headers


def _periodo_id(client, headers) -> int:
    return client.get("/periodo-semestral", headers=headers).json()[0]["id_periodo"]


def _post_grupo(client, headers, seed, nombre_grupo="1A"):
    resp = client.post(
        "/grupo",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "id_periodo": _periodo_id(client, headers),
            "semestre": 1,
            "nombre_grupo": nombre_grupo,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _post_asignatura(client, headers, clave="MAT-01"):
    resp = client.post(
        "/asignatura",
        headers=headers,
        json={"clave_asignatura": clave, "nombre": "Matemáticas", "semestre": 1},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- GET: abierto a todos los roles -------------------------------------


def test_grupo_get_allowed_for_docente_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/grupo", headers=headers)
    assert resp.status_code == 200


def test_grupo_get_allowed_for_directivo_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/grupo", headers=headers)
    assert resp.status_code == 200


def test_grupo_get_allowed_for_admin_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/grupo", headers=headers)
    assert resp.status_code == 200


def test_asignatura_get_allowed_for_docente_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/asignatura", headers=headers)
    assert resp.status_code == 200


def test_asignatura_get_allowed_for_directivo_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/asignatura", headers=headers)
    assert resp.status_code == 200


def test_asignatura_get_allowed_for_admin_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/asignatura", headers=headers)
    assert resp.status_code == 200


# --- Grupo: directivo/admin C, R, U; docente solo R ----------------------


def test_grupo_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    id_periodo = _periodo_id(client, headers)
    resp = client.post(
        "/grupo",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "id_periodo": id_periodo,
            "semestre": 1,
            "nombre_grupo": "1A",
        },
    )
    assert resp.status_code == 403


def test_grupo_create_directivo_created_201(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    grupo = _post_grupo(client, headers, seed)
    assert grupo["nombre_grupo"] == "1A"


def test_grupo_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    grupo = _post_grupo(client, headers, seed)
    assert grupo["nombre_grupo"] == "1A"


def test_grupo_put_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    grupo = _post_grupo(client, admin_headers, seed)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.put(
        f"/grupo/{grupo['id_grupo']}", headers=docente_headers, json={"nombre_grupo": "1B"}
    )
    assert resp.status_code == 403


def test_grupo_put_directivo_updates_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    grupo = _post_grupo(client, headers, seed)
    resp = client.put(f"/grupo/{grupo['id_grupo']}", headers=headers, json={"nombre_grupo": "1B"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["nombre_grupo"] == "1B"


def test_grupo_put_admin_updates_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    grupo = _post_grupo(client, headers, seed)
    resp = client.put(f"/grupo/{grupo['id_grupo']}", headers=headers, json={"nombre_grupo": "1B"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["nombre_grupo"] == "1B"


def test_grupo_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/grupo/999999", headers=headers, json={"nombre_grupo": "1B"})
    assert resp.status_code == 404


# --- Asignatura: directivo/admin C, R, U; docente solo R -----------------


def test_asignatura_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/asignatura",
        headers=headers,
        json={"clave_asignatura": "MAT-01", "nombre": "Matemáticas", "semestre": 1},
    )
    assert resp.status_code == 403


def test_asignatura_create_directivo_created_201(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    asignatura = _post_asignatura(client, headers)
    assert asignatura["activa"] is True


def test_asignatura_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    asignatura = _post_asignatura(client, headers)
    assert asignatura["activa"] is True


def test_asignatura_put_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    asignatura = _post_asignatura(client, admin_headers)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.put(
        f"/asignatura/{asignatura['id_asignatura']}",
        headers=docente_headers,
        json={"activa": False},
    )
    assert resp.status_code == 403


def test_asignatura_put_directivo_updates_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    asignatura = _post_asignatura(client, headers)
    resp = client.put(
        f"/asignatura/{asignatura['id_asignatura']}", headers=headers, json={"activa": False}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["activa"] is False


def test_asignatura_put_admin_updates_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    asignatura = _post_asignatura(client, headers)
    resp = client.put(
        f"/asignatura/{asignatura['id_asignatura']}", headers=headers, json={"activa": False}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["activa"] is False


def test_asignatura_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/asignatura/999999", headers=headers, json={"activa": False})
    assert resp.status_code == 404


# --- Grupo_Asignatura: escritura solo directivo/admin; lectura con scope -


def _crear_grupo_asignatura(client, headers, seed, id_docente, nombre_grupo, clave_asignatura):
    grupo = _post_grupo(client, headers, seed, nombre_grupo)
    asignatura = _post_asignatura(client, headers, clave_asignatura)
    resp = client.post(
        "/grupo-asignatura",
        headers=headers,
        json={
            "id_grupo": grupo["id_grupo"],
            "id_asignatura": asignatura["id_asignatura"],
            "id_docente": id_docente,
            "id_periodo": grupo["id_periodo"],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _crear_docente(client, admin_headers, seed, email, curp, password):
    resp = client.post(
        "/personal",
        headers=admin_headers,
        json={
            "id_plantel": seed["id_plantel"],
            "curp": curp,
            "nombre": "Docente",
            "apellido_paterno": "Extra",
            "email_institucional": email,
            "rol": "docente",
            "password": password,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id_personal"]


def test_grupo_asignatura_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    id_periodo = _periodo_id(client, headers)
    resp = client.post(
        "/grupo-asignatura",
        headers=headers,
        json={
            "id_grupo": 1,
            "id_asignatura": 1,
            "id_docente": seed["ids"]["docente1@sige.test"],
            "id_periodo": id_periodo,
        },
    )
    assert resp.status_code == 403


def test_grupo_asignatura_create_directivo_created_201(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura = _crear_grupo_asignatura(client, headers, seed, id_docente, "1A", "MAT-01")
    assert grupo_asignatura["id_docente"] == id_docente


def test_grupo_asignatura_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura = _crear_grupo_asignatura(client, headers, seed, id_docente, "1A", "MAT-01")
    assert grupo_asignatura["id_docente"] == id_docente


def test_grupo_asignatura_scope_docente_sees_only_own_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)

    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )

    _crear_grupo_asignatura(client, admin_headers, seed, id_docente_1, "1A", "MAT-01")
    _crear_grupo_asignatura(client, admin_headers, seed, id_docente_2, "1B", "MAT-02")

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/grupo-asignatura", headers=docente1_headers)
    assert resp.status_code == 200
    assert [ga["id_docente"] for ga in resp.json()] == [id_docente_1]

    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    resp = client.get("/grupo-asignatura", headers=docente2_headers)
    assert resp.status_code == 200
    assert [ga["id_docente"] for ga in resp.json()] == [id_docente_2]

    resp = client.get("/grupo-asignatura", headers=admin_headers)
    assert resp.status_code == 200
    assert {ga["id_docente"] for ga in resp.json()} == {id_docente_1, id_docente_2}


def test_grupo_asignatura_put_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente, "1A", "MAT-01"
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.put(
        f"/grupo-asignatura/{grupo_asignatura['id_grupo_asig']}",
        headers=docente_headers,
        json={"id_docente": id_docente},
    )
    assert resp.status_code == 403


def test_grupo_asignatura_put_directivo_updates_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )

    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    grupo_asignatura = _crear_grupo_asignatura(
        client, headers, seed, id_docente_1, "1A", "MAT-01"
    )

    resp = client.put(
        f"/grupo-asignatura/{grupo_asignatura['id_grupo_asig']}",
        headers=headers,
        json={"id_docente": id_docente_2},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id_docente"] == id_docente_2


def test_grupo_asignatura_put_admin_updates_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    grupo_asignatura = _crear_grupo_asignatura(
        client, headers, seed, id_docente_1, "1A", "MAT-01"
    )

    resp = client.put(
        f"/grupo-asignatura/{grupo_asignatura['id_grupo_asig']}",
        headers=headers,
        json={"id_docente": id_docente_2},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id_docente"] == id_docente_2


def test_grupo_asignatura_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put(
        "/grupo-asignatura/999999",
        headers=headers,
        json={"id_docente": seed["ids"]["docente1@sige.test"]},
    )
    assert resp.status_code == 404


# --- Grupo_Asignatura: trigger fn_valida_rol_docente (db/ddl_mvp.sql) debe
# traducirse a un 4xx claro, no propagar el error crudo de Postgres como 500 -


def test_grupo_asignatura_create_id_docente_not_docente_role_400(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    grupo = _post_grupo(client, headers, seed)
    asignatura = _post_asignatura(client, headers)

    resp = client.post(
        "/grupo-asignatura",
        headers=headers,
        json={
            "id_grupo": grupo["id_grupo"],
            "id_asignatura": asignatura["id_asignatura"],
            "id_docente": seed["ids"]["admin1@sige.test"],
            "id_periodo": grupo["id_periodo"],
        },
    )
    assert 400 <= resp.status_code < 500, resp.text
