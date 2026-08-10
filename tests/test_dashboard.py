"""Tests de autorización + cálculo para GET /dashboard/resumen
(dashboard/): mismo patrón que test_control_escolar.py -- cada rol pide el
mismo endpoint y recibe una forma de respuesta distinta según su scope
(matriz RBAC, docs/rbac/matriz-rbac-mvp.md, Nivel 2).
"""

from sqlalchemy import text

from app.core.security import authenticate_personal
from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, auth_headers
from tests.test_academico import _crear_docente, _crear_grupo_asignatura
from tests.test_alumnos import _post_alumno
from tests.test_control_escolar import _post_calificacion
from tests.test_login_rls_e2e import _set_session

CAMPOS_DIRECTIVO = {"matricula_total", "grupos_activos", "personal_activo", "asignaturas_configuradas"}
CAMPOS_DOCENTE = {
    "numero_grupos_asignados",
    "numero_alumnos_bajo_responsabilidad",
    "calificaciones_pendientes",
}


# --- Cada rol recibe solo la forma de su propio scope ----------------------


def test_dashboard_docente_recibe_solo_su_resumen_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/dashboard/resumen", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == CAMPOS_DOCENTE
    assert not CAMPOS_DIRECTIVO & set(body.keys())


def test_dashboard_directivo_recibe_solo_resumen_de_plantel_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/dashboard/resumen", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == CAMPOS_DIRECTIVO
    assert not CAMPOS_DOCENTE & set(body.keys())


def test_dashboard_admin_recibe_solo_resumen_de_plantel_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/dashboard/resumen", headers=headers)
    assert resp.status_code == 200
    assert set(resp.json().keys()) == CAMPOS_DIRECTIVO


# --- Directivo/admin: agregados de todo el plantel --------------------------


def test_dashboard_directivo_matricula_total_cuenta_solo_alumnos_activos(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente, "1A", "MAT-01"
    )
    _post_alumno(client, admin_headers, seed, n=1, id_grupo=grupo_asignatura["id_grupo"])
    alumno_baja = _post_alumno(
        client,
        admin_headers,
        seed,
        n=2,
        id_grupo=grupo_asignatura["id_grupo"],
        matricula="MAT-0002",
        curp="CURPALUM0000000002",
    )
    resp_baja = client.put(
        f"/alumno/{alumno_baja['id_alumno']}", headers=admin_headers, json={"estatus": "baja"}
    )
    assert resp_baja.status_code == 200, resp_baja.text

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/dashboard/resumen", headers=directivo_headers)
    assert resp.status_code == 200
    assert resp.json()["matricula_total"] == 1


def test_dashboard_directivo_grupos_activos_cuenta_grupos_del_periodo_activo(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    _crear_grupo_asignatura(client, admin_headers, seed, id_docente, "1A", "MAT-01")
    _crear_grupo_asignatura(client, admin_headers, seed, id_docente, "1B", "MAT-02")

    resp = client.get("/dashboard/resumen", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["grupos_activos"] == 2


def test_dashboard_directivo_personal_activo_excluye_bajas(client, seed):
    # seed ya siembra 1 docente activo + 1 docente de baja + 1 directivo + 1 admin.
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/dashboard/resumen", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["personal_activo"] == 3


def test_dashboard_directivo_asignaturas_configuradas_cuenta_solo_activas(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    client.post(
        "/asignatura",
        headers=admin_headers,
        json={"clave_asignatura": "MAT-01", "nombre": "Matemáticas", "semestre": 1},
    )
    client.post(
        "/asignatura",
        headers=admin_headers,
        json={
            "clave_asignatura": "MAT-02",
            "nombre": "Descontinuada",
            "semestre": 1,
            "activa": False,
        },
    )

    resp = client.get("/dashboard/resumen", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["asignaturas_configuradas"] == 1


# --- Docente: agregados de su propio scope ----------------------------------


def test_dashboard_docente_grupos_y_alumnos_no_incluyen_otro_docente(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )

    grupo_asignatura_1 = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente_1, "1A", "MAT-01"
    )
    grupo_asignatura_2 = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente_2, "1B", "MAT-02"
    )
    _post_alumno(client, admin_headers, seed, n=1, id_grupo=grupo_asignatura_1["id_grupo"])
    _post_alumno(client, admin_headers, seed, n=2, id_grupo=grupo_asignatura_2["id_grupo"])

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/dashboard/resumen", headers=docente1_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["numero_grupos_asignados"] == 1
    assert body["numero_alumnos_bajo_responsabilidad"] == 1


def test_dashboard_docente_grupos_asignados_no_duplica_por_dos_materias_mismo_grupo(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura_1 = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente, "1A", "MAT-01"
    )
    # Mismo grupo, segunda materia -- mismo docente.
    resp_asignatura = client.post(
        "/asignatura",
        headers=admin_headers,
        json={"clave_asignatura": "MAT-02", "nombre": "Física", "semestre": 1},
    )
    client.post(
        "/grupo-asignatura",
        headers=admin_headers,
        json={
            "id_grupo": grupo_asignatura_1["id_grupo"],
            "id_asignatura": resp_asignatura.json()["id_asignatura"],
            "id_docente": id_docente,
            "id_periodo": grupo_asignatura_1["id_periodo"],
        },
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/dashboard/resumen", headers=docente_headers)
    assert resp.status_code == 200
    assert resp.json()["numero_grupos_asignados"] == 1


def test_dashboard_docente_calificaciones_pendientes_cuenta_faltantes(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente, "1A", "MAT-01"
    )
    alumno_1 = _post_alumno(client, admin_headers, seed, n=1, id_grupo=grupo_asignatura["id_grupo"])
    alumno_2 = _post_alumno(client, admin_headers, seed, n=2, id_grupo=grupo_asignatura["id_grupo"])

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    # alumno_1: calificación completa (calificacion_final ya no es None).
    _post_calificacion(
        client,
        docente_headers,
        alumno_1["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=8,
        parcial_2=8,
        parcial_3=8,
    )
    # alumno_2: sin ninguna fila de Calificacion todavía -- también pendiente.

    resp = client.get("/dashboard/resumen", headers=docente_headers)
    assert resp.status_code == 200
    assert resp.json()["calificaciones_pendientes"] == 1


def test_dashboard_docente_sin_grupos_recibe_ceros(client, seed):
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/dashboard/resumen", headers=docente_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["numero_grupos_asignados"] == 0
    assert body["numero_alumnos_bajo_responsabilidad"] == 0
    assert body["calificaciones_pendientes"] == 0


# --- Bypass de RLS via consulta directa a las vistas (sin pasar por el ------
# endpoint): mismo patrón que
# test_expediente_direct_query_docente_out_of_scope_blocked_by_rls
# (tests/test_alumnos.py, Fase 4). Las vistas se crearon sin
# `security_invoker`, así que Postgres evaluaba RLS con el owner de la
# vista (`sige_migrator`, también owner de `alumno`) en vez de con quien
# consulta -- un owner de tabla bypassea RLS por defecto, entonces
# cualquier sesión (incluida un docente sin relación con el alumno) veía
# el conteo real de TODO el plantel al consultar la vista directamente.


def test_vw_grupo_num_alumnos_direct_query_docente_out_of_scope_blocked_by_rls(
    client, seed, app_db
):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    _crear_grupo_asignatura(client, admin_headers, seed, id_docente_1, "1A", "MAT-01")
    grupo_asignatura_ajeno = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente_2, "1B", "MAT-02"
    )
    # Alumno en el grupo del docente 2 -- fuera del scope del docente 1.
    _post_alumno(client, admin_headers, seed, n=1, id_grupo=grupo_asignatura_ajeno["id_grupo"])

    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    row = app_db.execute(
        text("SELECT num_alumnos_inscritos FROM vw_grupo_num_alumnos WHERE id_grupo = :id_grupo"),
        {"id_grupo": grupo_asignatura_ajeno["id_grupo"]},
    ).first()
    assert row.num_alumnos_inscritos == 0, (
        "RLS debió bloquear el conteo de alumnos de un grupo ajeno al docente"
    )


def test_vw_plantel_matricula_total_direct_query_docente_scoped_by_rls(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    grupo_asignatura_1 = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente_1, "1A", "MAT-01"
    )
    grupo_asignatura_2 = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente_2, "1B", "MAT-02"
    )
    _post_alumno(client, admin_headers, seed, n=1, id_grupo=grupo_asignatura_1["id_grupo"])
    _post_alumno(client, admin_headers, seed, n=2, id_grupo=grupo_asignatura_2["id_grupo"])

    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    row = app_db.execute(text("SELECT matricula_total FROM vw_plantel_matricula_total")).first()
    # El plantel completo tiene 2 alumnos activos, pero el docente 1 solo
    # debe poder "ver" (vía RLS de alumno_select) al suyo propio -- no el
    # total real del plantel, que es un dato fuera de su scope.
    assert row.matricula_total == 1, (
        "RLS debió acotar matricula_total al scope del docente, no al plantel completo"
    )
