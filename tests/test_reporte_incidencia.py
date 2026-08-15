"""Tests de autorización + scope para app/domains/reportes/ (ADR-010):
un docente activo reporta sobre CUALQUIER alumno del plantel, sin
requerir grupo_asignatura -- a diferencia de Calificacion/Asistencia.
"""

from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, PASSWORD_DOCENTE_BAJA, auth_headers
from tests.test_academico import _crear_docente
from tests.test_alumnos import _post_alumno

FECHA = "2026-08-14"


def _post_reporte(client, headers, id_alumno, fecha=FECHA, descripcion="Prueba"):
    return client.post(
        "/reporte-incidencia",
        headers=headers,
        json={"id_alumno": id_alumno, "fecha_incidente": fecha, "descripcion": descripcion},
    )


def test_docente_crea_reporte_sobre_alumno_fuera_de_su_scope_201(client, seed):
    # El alumno no está inscrito en ningún grupo del docente -- a
    # diferencia de Calificacion/Asistencia, esto debe funcionar (ADR-010).
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = _post_reporte(client, docente_headers, alumno["id_alumno"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["id_alumno"] == alumno["id_alumno"]
    assert body["id_personal_reporta"] == seed["ids"]["docente1@sige.test"]
    assert body["fecha_incidente"] == FECHA


def test_docente_dado_de_baja_forbidden_403(client, seed):
    # Un docente dado de baja nunca llega a tener un JWT: fn_login_lookup
    # (ADR-007) solo devuelve credenciales para estatus='activo', así que
    # el bloqueo real ocurre en /auth/login (401), no en este endpoint --
    # mismo comportamiento ya confirmado por
    # test_auth_rbac.py::test_login_baja_personal_cannot_authenticate_401.
    resp = client.post(
        "/auth/login",
        json={"email_institucional": "docente.baja@sige.test", "password": PASSWORD_DOCENTE_BAJA},
    )
    assert resp.status_code == 401, resp.text


def test_directivo_no_puede_crear_reporte_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = _post_reporte(client, directivo_headers, alumno["id_alumno"])
    assert resp.status_code == 403, resp.text


def test_docente_no_ve_reporte_de_otro_docente(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_reporte(client, docente1_headers, alumno["id_alumno"], descripcion="De docente 1")

    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    resp = _post_reporte(client, docente2_headers, alumno["id_alumno"], descripcion="De docente 2")
    assert resp.status_code == 201, resp.text

    listado_docente1 = client.get(
        "/reporte-incidencia", headers=docente1_headers, params={"id_alumno": alumno["id_alumno"]}
    )
    assert listado_docente1.status_code == 200, listado_docente1.text
    descripciones = [r["descripcion"] for r in listado_docente1.json()]
    assert descripciones == ["De docente 1"]


def test_directivo_ve_todos_los_reportes_del_plantel(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_reporte(client, docente_headers, alumno["id_alumno"])

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get(
        "/reporte-incidencia", headers=directivo_headers, params={"id_alumno": alumno["id_alumno"]}
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1


def test_sin_endpoint_put_delete_405(client, seed):
    # router.py solo registra /reporte-incidencia (POST + GET), sin ruta
    # {id} en absoluto -- a diferencia de auditoria_calificacion, que
    # también carece de PUT/DELETE pero sobre el mismo path que GET/POST.
    # PUT/DELETE contra /reporte-incidencia/{id} (una ruta que no existe
    # ni siquiera para GET) daría 404 de Starlette, no 405: para probar
    # "método no permitido" hay que pegarle al path que sí está
    # registrado, mismo patrón que
    # test_control_escolar.py::test_auditoria_calificacion_put_does_not_exist_405.
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)

    put_resp = client.put(
        "/reporte-incidencia", headers=docente_headers, json={"descripcion": "editado"}
    )
    assert put_resp.status_code == 405, put_resp.text

    delete_resp = client.delete("/reporte-incidencia", headers=docente_headers)
    assert delete_resp.status_code == 405, delete_resp.text


def test_update_delete_directo_bloqueado_por_rls(client, seed):
    # Defensa en profundidad: ni siquiera admin puede UPDATE/DELETE
    # directo a la tabla, no solo "no hay endpoint" -- mismo rigor que
    # auditoria_calificacion (Fase 5).
    import os

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    creado = _post_reporte(client, docente_headers, alumno["id_alumno"]).json()

    app_engine = create_engine(os.environ["DATABASE_URL"])
    AppSession = sessionmaker(bind=app_engine)
    with AppSession() as db:
        db.execute(text("SELECT set_config('app.current_rol', 'admin', true)"))
        db.execute(
            text("SELECT set_config('app.current_personal_id', :id, true)"),
            {"id": str(seed["ids"]["admin1@sige.test"])},
        )
        result = db.execute(
            text("UPDATE reporte_incidencia SET descripcion = 'hackeado' WHERE id_reporte_incidencia = :id"),
            {"id": creado["id_reporte_incidencia"]},
        )
        assert result.rowcount == 0
        result = db.execute(
            text("DELETE FROM reporte_incidencia WHERE id_reporte_incidencia = :id"),
            {"id": creado["id_reporte_incidencia"]},
        )
        assert result.rowcount == 0
        db.rollback()


def test_docente_desactivado_reusa_jwt_stale_bloqueado_por_rls_403(client, seed):
    # Defensa en profundidad de ADR-010: reporte_incidencia_insert exige
    # EXISTS(... estatus='activo') a nivel de RLS, no solo require_roles
    # ("docente") a nivel de FastAPI -- un JWT emitido mientras el docente
    # estaba activo debe seguir siendo rechazado si se reusa después de
    # que admin lo dé de baja (el JWT no se revoca, sigue siendo válido
    # hasta su expiración; el rechazo real lo hace RLS, no el login).
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    alumno = _post_alumno(client, admin_headers, seed, n=1, id_grupo=None)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)

    id_docente = seed["ids"]["docente1@sige.test"]
    put_resp = client.put(
        f"/personal/{id_docente}", headers=admin_headers, json={"estatus": "baja"}
    )
    assert put_resp.status_code == 200, put_resp.text

    resp = _post_reporte(client, docente_headers, alumno["id_alumno"])
    assert resp.status_code == 403, resp.text
