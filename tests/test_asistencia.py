"""Tests de autorización + lote/UPSERT para app/domains/asistencia/ --
primera entidad post-MVP (ADR-008), mismo patrón que test_control_escolar.py.
"""

from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, auth_headers
from tests.test_academico import _crear_docente
from tests.test_alumnos import _post_alumno
from tests.test_control_escolar import _docente_alumno_grupo_asig

FECHA = "2026-08-11"


def _post_lote(client, headers, id_grupo_asig, fecha, registros):
    return client.post(
        "/asistencia/lote",
        headers=headers,
        json={"id_grupo_asig": id_grupo_asig, "fecha_sesion": fecha, "registros": registros},
    )


# --- POST /asistencia/lote: solo docente captura --------------------------


def test_asistencia_lote_docente_captura_201(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = _post_lote(
        client,
        docente_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id_alumno"] == alumno["id_alumno"]
    assert body[0]["estado"] == "presente"
    assert body[0]["id_personal_registro"] == id_docente
    assert body[0]["fecha_sesion"] == FECHA


def test_asistencia_lote_directivo_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = _post_lote(
        client,
        directivo_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )
    assert resp.status_code == 403, resp.text


def test_asistencia_lote_admin_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    resp = _post_lote(
        client,
        admin_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )
    assert resp.status_code == 403, resp.text


def test_asistencia_lote_grupo_asignatura_ajeno_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_1, n=1, nombre_grupo="1A"
    )
    _crear_docente(client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1")
    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")

    resp = _post_lote(
        client,
        docente2_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )
    assert resp.status_code == 403, resp.text


def test_asistencia_lote_duplicate_alumno_in_payload_422(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = _post_lote(
        client,
        docente_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [
            {"id_alumno": alumno["id_alumno"], "estado": "presente"},
            {"id_alumno": alumno["id_alumno"], "estado": "ausente"},
        ],
    )
    assert resp.status_code == 422, resp.text


# --- UPSERT: recaptura del mismo grupo+fecha corrige, no falla con 409 ----


def test_asistencia_lote_upsert_corrige_sin_409(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)

    primera = _post_lote(
        client,
        docente_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )
    assert primera.status_code == 201, primera.text

    segunda = _post_lote(
        client,
        docente_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "ausente"}],
    )
    assert segunda.status_code == 201, segunda.text
    assert segunda.json()[0]["estado"] == "ausente"

    # Confirma que corrigió la misma fila (no duplicó) -- una sola fila
    # para ese alumno+grupo+fecha, con el estado más reciente.
    resp = client.get(
        "/asistencia",
        headers=docente_headers,
        params={"id_grupo_asig": grupo_asignatura["id_grupo_asig"], "fecha": FECHA},
    )
    assert resp.status_code == 200
    filas = [f for f in resp.json() if f["id_alumno"] == alumno["id_alumno"]]
    assert len(filas) == 1
    assert filas[0]["estado"] == "ausente"


def test_asistencia_lote_multiples_alumnos_una_transaccion_201(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno_1 = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente, n=1, nombre_grupo="1A"
    )
    alumno_2 = _post_alumno(
        client, admin_headers, seed, n=2, id_grupo=grupo_asignatura["id_grupo"]
    )
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)

    resp = _post_lote(
        client,
        docente_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [
            {"id_alumno": alumno_1["id_alumno"], "estado": "presente"},
            {"id_alumno": alumno_2["id_alumno"], "estado": "retardo"},
        ],
    )
    assert resp.status_code == 201, resp.text
    body = {r["id_alumno"]: r["estado"] for r in resp.json()}
    assert body[alumno_1["id_alumno"]] == "presente"
    assert body[alumno_2["id_alumno"]] == "retardo"


# --- GET /asistencia: scope por rol ----------------------------------------


def test_asistencia_get_scope_docente_no_ve_grupo_ajeno_200_vacio(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_1, n=1, nombre_grupo="1A"
    )
    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_lote(
        client,
        docente1_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )

    _crear_docente(client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1")
    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")

    resp = client.get(
        "/asistencia",
        headers=docente2_headers,
        params={"id_grupo_asig": grupo_asignatura["id_grupo_asig"], "fecha": FECHA},
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_asistencia_get_directivo_ve_todo_el_plantel_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_lote(
        client,
        docente_headers,
        grupo_asignatura["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "retardo"}],
    )

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get(
        "/asistencia",
        headers=directivo_headers,
        params={"id_grupo_asig": grupo_asignatura["id_grupo_asig"], "fecha": FECHA},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["estado"] == "retardo"


# --- GET /asistencia/resumen/{id_alumno}: agregado al vuelo ---------------


def test_asistencia_resumen_agrega_conteos_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)

    for fecha, estado in [
        ("2026-08-10", "presente"),
        ("2026-08-11", "presente"),
        ("2026-08-12", "ausente"),
        ("2026-08-13", "retardo"),
    ]:
        resp = _post_lote(
            client,
            docente_headers,
            grupo_asignatura["id_grupo_asig"],
            fecha,
            [{"id_alumno": alumno["id_alumno"], "estado": estado}],
        )
        assert resp.status_code == 201, resp.text

    resp = client.get(f"/asistencia/resumen/{alumno['id_alumno']}", headers=docente_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "id_alumno": alumno["id_alumno"],
        "presente": 2,
        "ausente": 1,
        "retardo": 1,
        "total": 4,
    }


def test_asistencia_resumen_scope_docente_excluye_otras_materias_200(client, seed):
    """Un docente que consulta el resumen de un alumno solo ve las sesiones
    de SUS propios grupo_asignatura -- si el alumno tiene asistencia
    capturada por otro docente (otra materia), esa no cuenta aquí (mismo
    scope de fila que asistencia_select, RLS)."""
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    grupo_asignatura_1, alumno = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_1, n=1, nombre_grupo="1A"
    )
    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = _post_lote(
        client,
        docente1_headers,
        grupo_asignatura_1["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "presente"}],
    )
    assert resp.status_code == 201, resp.text

    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    grupo_asignatura_2 = client.post(
        "/grupo-asignatura",
        headers=admin_headers,
        json={
            "id_grupo": grupo_asignatura_1["id_grupo"],
            "id_asignatura": client.post(
                "/asignatura",
                headers=admin_headers,
                json={"clave_asignatura": "HIS-01", "nombre": "Historia", "semestre": 1},
            ).json()["id_asignatura"],
            "id_docente": id_docente_2,
            "id_periodo": grupo_asignatura_1["id_periodo"],
        },
    ).json()
    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    resp = _post_lote(
        client,
        docente2_headers,
        grupo_asignatura_2["id_grupo_asig"],
        FECHA,
        [{"id_alumno": alumno["id_alumno"], "estado": "ausente"}],
    )
    assert resp.status_code == 201, resp.text

    resp_docente1 = client.get(f"/asistencia/resumen/{alumno['id_alumno']}", headers=docente1_headers)
    assert resp_docente1.status_code == 200
    assert resp_docente1.json()["total"] == 1
    assert resp_docente1.json()["presente"] == 1

    resp_directivo = client.get(
        f"/asistencia/resumen/{alumno['id_alumno']}",
        headers=auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO),
    )
    assert resp_directivo.status_code == 200
    assert resp_directivo.json()["total"] == 2


def test_asistencia_resumen_sin_datos_devuelve_ceros_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    _, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    resp = client.get(f"/asistencia/resumen/{alumno['id_alumno']}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json() == {
        "id_alumno": alumno["id_alumno"],
        "presente": 0,
        "ausente": 0,
        "retardo": 0,
        "total": 0,
    }
