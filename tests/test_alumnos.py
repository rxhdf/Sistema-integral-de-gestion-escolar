"""Tests de autorización + scope + filtrado de campos para Fase 4
(alumnos/): Alumno, Expediente_Academico — mismo patrón que
test_academico.py, contra la matriz RBAC (docs/rbac/matriz-rbac-mvp.md).
"""

from sqlalchemy import text

from app.core.security import authenticate_personal
from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, auth_headers
from tests.test_academico import (
    _crear_docente,
    _crear_grupo_asignatura,
)
from tests.test_login_rls_e2e import _set_session

CAMPOS_SENSIBLES = {"fecha_nacimiento", "email", "telefono_personal"}
CAMPOS_ORIGEN = {"municipio_origen", "localidad_origen"}


def _post_alumno(client, headers, seed, n=1, id_grupo=None, **overrides):
    payload = {
        "id_plantel": seed["id_plantel"],
        "id_grupo": id_grupo,
        "matricula": f"MAT-{n:04d}",
        "curp": f"CURPALUM{n:010d}",
        "nombre": "Alumno",
        "apellido_paterno": "Prueba",
        "fecha_nacimiento": "2008-01-01",
        "sexo": "M",
        "email": "alumno@sige.test",
        "telefono_personal": "5551234567",
        "fecha_inscripcion": "2026-08-01",
    }
    payload.update(overrides)
    resp = client.post("/alumno", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _docente_con_grupo(client, admin_headers, seed, id_docente, nombre_grupo, clave_asignatura):
    """Da de alta un grupo_asignatura activo para id_docente y regresa el
    id_grupo resultante (mismo patrón de scope ya validado en Fase 3)."""
    grupo_asignatura = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente, nombre_grupo, clave_asignatura
    )
    return grupo_asignatura["id_grupo"]


# --- GET /alumno: abierto a todos los roles ------------------------------


def test_alumno_get_allowed_for_docente_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno", headers=headers)
    assert resp.status_code == 200


def test_alumno_get_allowed_for_directivo_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/alumno", headers=headers)
    assert resp.status_code == 200


def test_alumno_get_allowed_for_admin_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/alumno", headers=headers)
    assert resp.status_code == 200


# --- Nivel 3: filtrado de campos sensibles para docente -------------------


def test_alumno_get_docente_view_omits_sensitive_fields_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    id_grupo = _docente_con_grupo(client, admin_headers, seed, id_docente, "1A", "MAT-01")
    _post_alumno(client, admin_headers, seed, n=1, id_grupo=id_grupo)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno", headers=docente_headers)
    assert resp.status_code == 200
    alumnos = resp.json()
    assert len(alumnos) == 1
    assert not CAMPOS_SENSIBLES & alumnos[0].keys()
    assert alumnos[0]["curp"] == f"CURPALUM{1:010d}"


def test_alumno_get_directivo_view_includes_all_fields_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    _post_alumno(client, admin_headers, seed, n=1)

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/alumno", headers=directivo_headers)
    assert resp.status_code == 200
    alumnos = resp.json()
    assert len(alumnos) == 1
    assert CAMPOS_SENSIBLES <= alumnos[0].keys()


# --- docs/data_dictionary/perfil-analisis-alumno.md: municipio_origen/
# localidad_origen -- mismo criterio que fecha_nacimiento/email/
# telefono_personal (excluidos de AlumnoOutDocente, ver schemas.py).


def test_alumno_get_docente_view_omits_origen_fields_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    id_grupo = _docente_con_grupo(client, admin_headers, seed, id_docente, "1A", "MAT-01")
    _post_alumno(
        client,
        admin_headers,
        seed,
        n=1,
        id_grupo=id_grupo,
        municipio_origen="Oaxaca de Juárez",
        localidad_origen="Centro",
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno", headers=docente_headers)
    assert resp.status_code == 200
    assert not CAMPOS_ORIGEN & resp.json()[0].keys()


def test_alumno_get_directivo_view_includes_origen_fields_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    _post_alumno(
        client, headers, seed, n=1, municipio_origen="Oaxaca de Juárez", localidad_origen="Centro"
    )

    resp = client.get("/alumno", headers=headers)
    assert resp.status_code == 200
    alumno = resp.json()[0]
    assert CAMPOS_ORIGEN <= alumno.keys()
    assert alumno["municipio_origen"] == "Oaxaca de Juárez"
    assert alumno["localidad_origen"] == "Centro"


# --- GET /alumno?search=: coincidencia parcial de nombre completo o CURP
# exacta (docs/data_dictionary/perfil-analisis-alumno.md, Pieza 2) -------


def test_alumno_search_partial_nombre_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    _post_alumno(client, headers, seed, n=1, nombre="Maria", apellido_paterno="Lopez")
    _post_alumno(client, headers, seed, n=2, nombre="Juan", apellido_paterno="Perez")

    resp = client.get("/alumno", headers=headers, params={"search": "aria Lop"})
    assert resp.status_code == 200
    assert [a["matricula"] for a in resp.json()] == ["MAT-0001"]


def test_alumno_search_curp_exacta_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    _post_alumno(client, headers, seed, n=1)
    _post_alumno(client, headers, seed, n=2)

    resp = client.get("/alumno", headers=headers, params={"search": f"CURPALUM{1:010d}"})
    assert resp.status_code == 200
    assert [a["matricula"] for a in resp.json()] == ["MAT-0001"]


def test_alumno_search_sin_resultados_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    _post_alumno(client, headers, seed, n=1)

    resp = client.get("/alumno", headers=headers, params={"search": "no-existe-nadie"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_alumno_search_respeta_scope_docente_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    id_grupo_1 = _docente_con_grupo(client, admin_headers, seed, id_docente_1, "1A", "MAT-01")
    id_grupo_2 = _docente_con_grupo(client, admin_headers, seed, id_docente_2, "1B", "MAT-02")
    _post_alumno(client, admin_headers, seed, n=1, id_grupo=id_grupo_1, nombre="Maria")
    _post_alumno(client, admin_headers, seed, n=2, id_grupo=id_grupo_2, nombre="Maria")

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno", headers=docente1_headers, params={"search": "Maria"})
    assert resp.status_code == 200
    assert [a["matricula"] for a in resp.json()] == ["MAT-0001"]


# --- Scope: docente solo ve alumnos de grupos donde tiene grupo_asignatura


def test_alumno_get_scope_docente_sees_only_own_group_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )

    id_grupo_1 = _docente_con_grupo(client, admin_headers, seed, id_docente_1, "1A", "MAT-01")
    id_grupo_2 = _docente_con_grupo(client, admin_headers, seed, id_docente_2, "1B", "MAT-02")

    _post_alumno(client, admin_headers, seed, n=1, id_grupo=id_grupo_1, matricula="MAT-0001")
    _post_alumno(client, admin_headers, seed, n=2, id_grupo=id_grupo_2, matricula="MAT-0002")

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno", headers=docente1_headers)
    assert resp.status_code == 200
    assert [a["matricula"] for a in resp.json()] == ["MAT-0001"]

    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    resp = client.get("/alumno", headers=docente2_headers)
    assert resp.status_code == 200
    assert [a["matricula"] for a in resp.json()] == ["MAT-0002"]

    resp = client.get("/alumno", headers=admin_headers)
    assert resp.status_code == 200
    assert {a["matricula"] for a in resp.json()} == {"MAT-0001", "MAT-0002"}


# --- Alumno: directivo/admin C, U; docente solo R -------------------------


def test_alumno_create_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/alumno",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "matricula": "MAT-0001",
            "curp": f"CURPALUM{1:010d}",
            "nombre": "Alumno",
            "apellido_paterno": "Prueba",
            "fecha_nacimiento": "2008-01-01",
            "fecha_inscripcion": "2026-08-01",
        },
    )
    assert resp.status_code == 403


def test_alumno_create_directivo_created_201(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    alumno = _post_alumno(client, headers, seed, n=1)
    assert alumno["matricula"] == "MAT-0001"


def test_alumno_create_admin_created_201(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, headers, seed, n=1)
    assert alumno["matricula"] == "MAT-0001"


def test_alumno_put_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.put(
        f"/alumno/{alumno['id_alumno']}", headers=docente_headers, json={"nombre": "Otro"}
    )
    assert resp.status_code == 403


def test_alumno_put_directivo_updates_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    alumno = _post_alumno(client, headers, seed, n=1)
    resp = client.put(f"/alumno/{alumno['id_alumno']}", headers=headers, json={"nombre": "Otro"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["nombre"] == "Otro"


def test_alumno_put_admin_updates_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, headers, seed, n=1)
    resp = client.put(f"/alumno/{alumno['id_alumno']}", headers=headers, json={"nombre": "Otro"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["nombre"] == "Otro"


def test_alumno_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/alumno/999999", headers=headers, json={"nombre": "Otro"})
    assert resp.status_code == 404


# --- POST /alumno/{id}/inscribir: solo directivo/admin --------------------


def test_alumno_inscribir_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        f"/alumno/{alumno['id_alumno']}/inscribir", headers=docente_headers, json={"id_grupo": 1}
    )
    assert resp.status_code == 403


def test_alumno_inscribir_directivo_assigns_grupo_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    alumno = _post_alumno(client, headers, seed, n=1)
    grupo = client.post(
        "/grupo",
        headers=headers,
        json={
            "id_plantel": seed["id_plantel"],
            "id_periodo": client.get("/periodo-semestral", headers=headers).json()[0][
                "id_periodo"
            ],
            "semestre": 1,
            "nombre_grupo": "1A",
        },
    ).json()

    resp = client.post(
        f"/alumno/{alumno['id_alumno']}/inscribir",
        headers=headers,
        json={"id_grupo": grupo["id_grupo"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id_grupo"] == grupo["id_grupo"]


def test_alumno_inscribir_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.post("/alumno/999999/inscribir", headers=headers, json={"id_grupo": 1})
    assert resp.status_code == 404


# --- Expediente_Academico: sin filtrado de campos, mismo scope que Alumno -


def test_expediente_create_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/expediente-academico",
        headers=docente_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )
    assert resp.status_code == 403


def test_expediente_create_directivo_created_201(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    alumno = _post_alumno(client, headers, seed, n=1)
    resp = client.post(
        "/expediente-academico",
        headers=headers,
        json={
            "id_alumno": alumno["id_alumno"],
            "escuela_procedencia": "Secundaria X",
            "promedio_secundaria": 8.5,
            "situacion_academica": "regular",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["promedio_secundaria"] == 8.5


def test_expediente_get_directivo_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    alumno = _post_alumno(client, headers, seed, n=1)
    client.post(
        "/expediente-academico",
        headers=headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )
    resp = client.get(f"/expediente-academico/{alumno['id_alumno']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id_alumno"] == alumno["id_alumno"]


def test_expediente_get_docente_in_scope_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    id_grupo = _docente_con_grupo(client, admin_headers, seed, id_docente, "1A", "MAT-01")
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=id_grupo)
    client.post(
        "/expediente-academico",
        headers=admin_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get(f"/expediente-academico/{alumno['id_alumno']}", headers=docente_headers)
    assert resp.status_code == 200


def test_expediente_get_docente_out_of_scope_404(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    # Alumno sin grupo asignado -> ningun docente tiene grupo_asignatura
    # que lo cubra, así que queda fuera del scope de cualquier docente.
    alumno = _post_alumno(client, admin_headers, seed, n=1)
    client.post(
        "/expediente-academico",
        headers=admin_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get(f"/expediente-academico/{alumno['id_alumno']}", headers=docente_headers)
    assert resp.status_code == 404


def test_expediente_get_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/expediente-academico/999999", headers=headers)
    assert resp.status_code == 404


def test_expediente_put_docente_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1)
    client.post(
        "/expediente-academico",
        headers=admin_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.put(
        f"/expediente-academico/{alumno['id_alumno']}",
        headers=docente_headers,
        json={"situacion_academica": "irregular"},
    )
    assert resp.status_code == 403


def test_expediente_put_directivo_updates_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    alumno = _post_alumno(client, headers, seed, n=1)
    client.post(
        "/expediente-academico",
        headers=headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )
    resp = client.put(
        f"/expediente-academico/{alumno['id_alumno']}",
        headers=headers,
        json={"situacion_academica": "irregular"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["situacion_academica"] == "irregular"


def test_expediente_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put(
        "/expediente-academico/999999", headers=headers, json={"situacion_academica": "regular"}
    )
    assert resp.status_code == 404


# --- Gap encontrado y corregido (docs/validacion/fase-04-alumnos.md):
# expediente_academico_select tenia USING(true) -- cualquier consulta que
# no pasara por service.get_expediente (un script, un endpoint nuevo)
# veia cualquier expediente sin importar el scope del docente. Esta
# prueba consulta la tabla directo, bypasseando el service por completo,
# para confirmar que ahora es RLS -- no Python -- quien bloquea.


def test_expediente_direct_query_docente_out_of_scope_blocked_by_rls(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    # Alumno sin grupo asignado: ningun docente tiene grupo_asignatura
    # que lo cubra, queda fuera del scope de cualquier docente.
    alumno = _post_alumno(client, admin_headers, seed, n=1)
    client.post(
        "/expediente-academico",
        headers=admin_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )

    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    rows = app_db.execute(
        text("SELECT id_exp_academico FROM expediente_academico WHERE id_alumno = :id_alumno"),
        {"id_alumno": alumno["id_alumno"]},
    ).all()
    assert rows == [], "RLS debió bloquear la lectura directa fuera de scope"


def test_expediente_direct_query_docente_in_scope_allowed_by_rls(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    id_grupo = _docente_con_grupo(client, admin_headers, seed, id_docente, "1A", "MAT-01")
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=id_grupo)
    client.post(
        "/expediente-academico",
        headers=admin_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )

    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    rows = app_db.execute(
        text("SELECT id_exp_academico FROM expediente_academico WHERE id_alumno = :id_alumno"),
        {"id_alumno": alumno["id_alumno"]},
    ).all()
    assert len(rows) == 1


def test_buscar_plantel_docente_encuentra_alumno_fuera_de_su_scope_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None, nombre="Zoe")

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/alumno/buscar-plantel", headers=docente_headers, params={"search": "Zoe"})
    assert resp.status_code == 200, resp.text
    assert [a["id_alumno"] for a in resp.json()] == [alumno["id_alumno"]]


def test_buscar_plantel_directivo_forbidden_403(client, seed):
    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/alumno/buscar-plantel", headers=directivo_headers, params={"search": "a"})
    assert resp.status_code == 403, resp.text
