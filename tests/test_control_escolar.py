"""Tests de autorización + cálculo (ADR-005) + auditoría (ADR-004) para
Fase 5 (control_escolar/): Calificacion, Auditoria_Calificacion — mismo
patrón que test_academico.py / test_alumnos.py.
"""

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.security import authenticate_personal
from tests.conftest import PASSWORD_ADMIN, PASSWORD_DIRECTIVO, PASSWORD_DOCENTE, auth_headers
from tests.test_academico import _crear_docente, _crear_grupo_asignatura
from tests.test_alumnos import _post_alumno
from tests.test_login_rls_e2e import _set_session


def _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente, n=1, nombre_grupo="1A"):
    grupo_asignatura = _crear_grupo_asignatura(
        client, admin_headers, seed, id_docente, nombre_grupo, f"MAT-{n:02d}"
    )
    alumno = _post_alumno(client, admin_headers, seed, n=n, id_grupo=grupo_asignatura["id_grupo"])
    return grupo_asignatura, alumno


def _post_calificacion(client, headers, id_alumno, id_grupo_asig, **overrides):
    payload = {"id_alumno": id_alumno, "id_grupo_asig": id_grupo_asig}
    payload.update(overrides)
    resp = client.post("/calificacion", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- GET /calificacion: abierto a todos los roles ------------------------


def test_calificacion_get_allowed_for_docente_200(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/calificacion", headers=headers)
    assert resp.status_code == 200


def test_calificacion_get_allowed_for_directivo_200(client, seed):
    headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.get("/calificacion", headers=headers)
    assert resp.status_code == 200


def test_calificacion_get_allowed_for_admin_200(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.get("/calificacion", headers=headers)
    assert resp.status_code == 200


def test_calificacion_get_scope_docente_sees_only_own_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    id_docente_2 = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )

    grupo_asignatura_1, alumno_1 = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_1, n=1, nombre_grupo="1A"
    )
    grupo_asignatura_2, alumno_2 = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_2, n=2, nombre_grupo="1B"
    )

    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion_1 = _post_calificacion(
        client, docente1_headers, alumno_1["id_alumno"], grupo_asignatura_1["id_grupo_asig"]
    )
    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    calificacion_2 = _post_calificacion(
        client, docente2_headers, alumno_2["id_alumno"], grupo_asignatura_2["id_grupo_asig"]
    )

    resp = client.get("/calificacion", headers=docente1_headers)
    assert resp.status_code == 200
    assert [c["id_calificacion"] for c in resp.json()] == [calificacion_1["id_calificacion"]]

    resp = client.get("/calificacion", headers=docente2_headers)
    assert resp.status_code == 200
    assert [c["id_calificacion"] for c in resp.json()] == [calificacion_2["id_calificacion"]]

    resp = client.get("/calificacion", headers=admin_headers)
    assert resp.status_code == 200
    assert {c["id_calificacion"] for c in resp.json()} == {
        calificacion_1["id_calificacion"],
        calificacion_2["id_calificacion"],
    }


# --- POST /calificacion: solo docente (matriz Nivel 1 + calificacion_insert)


def test_calificacion_create_docente_in_scope_201(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )
    assert calificacion["estatus"] == "pendiente"
    assert calificacion["calificacion_final"] is None


def test_calificacion_create_directivo_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.post(
        "/calificacion",
        headers=directivo_headers,
        json={
            "id_alumno": alumno["id_alumno"],
            "id_grupo_asig": grupo_asignatura["id_grupo_asig"],
        },
    )
    assert resp.status_code == 403


def test_calificacion_create_admin_forbidden_403(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    resp = client.post(
        "/calificacion",
        headers=admin_headers,
        json={
            "id_alumno": alumno["id_alumno"],
            "id_grupo_asig": grupo_asignatura["id_grupo_asig"],
        },
    )
    assert resp.status_code == 403


def test_calificacion_create_docente_ajeno_grupo_asignatura_403(client, seed):
    # Docente A no puede capturar una calificación en un grupo_asignatura
    # que pertenece a docente B (calificacion_insert, RLS + WITH CHECK).
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_b = _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    grupo_asignatura_b, alumno_b = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_b, n=2
    )

    docente_a_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.post(
        "/calificacion",
        headers=docente_a_headers,
        json={
            "id_alumno": alumno_b["id_alumno"],
            "id_grupo_asig": grupo_asignatura_b["id_grupo_asig"],
        },
    )
    assert resp.status_code == 403


# --- ADR-005: cálculo de calificacion_final / estatus ---------------------


def test_calificacion_final_pendiente_when_no_parciales_captured(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )
    assert calificacion["calificacion_final"] is None
    assert calificacion["estatus"] == "pendiente"


def test_calificacion_final_averages_only_captured_parciales(client, seed):
    # ADR-005: promedia sobre los parciales disponibles, no exige los 3.
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client,
        docente_headers,
        alumno["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=8,
        parcial_2=7,
    )
    assert calificacion["calificacion_final"] == 7.5
    assert calificacion["estatus"] == "aprobado"


def test_calificacion_final_aprobado_with_all_three_parciales(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client,
        docente_headers,
        alumno["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=8,
        parcial_2=8,
        parcial_3=8,
    )
    assert calificacion["calificacion_final"] == 8.0
    assert calificacion["estatus"] == "aprobado"


def test_calificacion_final_reprobado_below_umbral(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client,
        docente_headers,
        alumno["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=5,
        parcial_2=5,
        parcial_3=5,
    )
    assert calificacion["calificacion_final"] == 5.0
    assert calificacion["estatus"] == "reprobado"


# --- PUT /calificacion/{id}: docente (propia) + directivo/admin (todas) --


def test_calificacion_put_docente_owner_corrects_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client,
        docente_headers,
        alumno["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=6,
        parcial_2=6,
        parcial_3=6,
    )
    resp = client.put(
        f"/calificacion/{calificacion['id_calificacion']}",
        headers=docente_headers,
        json={"parcial_3": 9},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["calificacion_final"] == 7.0
    assert body["estatus"] == "aprobado"


def test_calificacion_put_directivo_corrects_any_200(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client,
        docente_headers,
        alumno["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=5,
        parcial_2=5,
        parcial_3=5,
    )

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    resp = client.put(
        f"/calificacion/{calificacion['id_calificacion']}",
        headers=directivo_headers,
        json={"parcial_1": 10, "parcial_2": 10, "parcial_3": 10},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estatus"] == "aprobado"


def test_calificacion_put_other_docente_not_found_404(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente_1 = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(
        client, admin_headers, seed, id_docente_1
    )
    docente1_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente1_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )

    _crear_docente(
        client, admin_headers, seed, "docente2@sige.test", "CURPDOCENTE0000002", "docente2-pass-1"
    )
    docente2_headers = auth_headers(client, "docente2@sige.test", "docente2-pass-1")
    resp = client.put(
        f"/calificacion/{calificacion['id_calificacion']}",
        headers=docente2_headers,
        json={"parcial_1": 10},
    )
    assert resp.status_code == 404


def test_calificacion_put_not_found_404(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/calificacion/999999", headers=headers, json={"parcial_1": 10})
    assert resp.status_code == 404


# --- ADR-004/005: promedio_actual del expediente se recalcula ------------


def test_captura_calificacion_recalcula_promedio_actual_del_expediente(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    client.post(
        "/expediente-academico",
        headers=admin_headers,
        json={"id_alumno": alumno["id_alumno"], "situacion_academica": "regular"},
    )

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    _post_calificacion(
        client,
        docente_headers,
        alumno["id_alumno"],
        grupo_asignatura["id_grupo_asig"],
        parcial_1=8,
        parcial_2=8,
        parcial_3=8,
    )

    resp = client.get(f"/expediente-academico/{alumno['id_alumno']}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["promedio_actual"] == 8.0


# --- Auditoría: captura y corrección quedan registradas -------------------


def test_captura_genera_auditoria_con_accion_captura(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )

    resp = client.get("/auditoria-calificacion", headers=admin_headers)
    assert resp.status_code == 200
    registros = [r for r in resp.json() if r["id_calificacion"] == calificacion["id_calificacion"]]
    assert len(registros) == 1
    assert registros[0]["accion"] == "captura"
    assert registros[0]["id_personal_capturo"] == id_docente
    assert registros[0]["valores_anteriores"] is None


def test_correccion_genera_auditoria_con_accion_correccion(client, seed):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)

    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"], parcial_1=5
    )

    directivo_headers = auth_headers(client, "directivo1@sige.test", PASSWORD_DIRECTIVO)
    id_directivo = seed["ids"]["directivo1@sige.test"]
    client.put(
        f"/calificacion/{calificacion['id_calificacion']}",
        headers=directivo_headers,
        json={"parcial_1": 9},
    )

    resp = client.get("/auditoria-calificacion", headers=admin_headers)
    correcciones = [
        r
        for r in resp.json()
        if r["id_calificacion"] == calificacion["id_calificacion"] and r["accion"] == "correccion"
    ]
    assert len(correcciones) == 1
    assert correcciones[0]["id_personal_modifico"] == id_directivo
    assert correcciones[0]["valores_anteriores"]["parcial_1"] == 5


def test_auditoria_get_docente_forbidden_403(client, seed):
    headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    resp = client.get("/auditoria-calificacion", headers=headers)
    assert resp.status_code == 403


# --- Gap corregido antes de Fase 5 (docs/validacion/fase-05-control-escolar.md):
# auditoria_calificacion_insert tenía WITH CHECK(true) -- cualquier sesión
# autenticada podía insertar una fila de auditoría suplantando a otro
# personal. Prueba directa, bypasseando el service, de que RLS ahora lo
# bloquea (y de que no bloquea el caso legítimo).


def test_auditoria_direct_insert_impersonation_blocked_by_rls(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )

    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    id_otro = seed["ids"]["directivo1@sige.test"]
    try:
        app_db.execute(
            text(
                "INSERT INTO auditoria_calificacion "
                "(id_calificacion, id_personal_capturo, accion, valores_nuevos) "
                "VALUES (:id_cal, :id_otro, 'captura', '{}'::jsonb)"
            ),
            {"id_cal": calificacion["id_calificacion"], "id_otro": id_otro},
        )
        app_db.commit()
        raised = False
    except DBAPIError:
        app_db.rollback()
        raised = True
    assert raised, "RLS debió bloquear el INSERT que suplanta a otro personal"


def test_auditoria_direct_insert_own_identity_allowed_by_rls(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )

    login = authenticate_personal(app_db, "docente1@sige.test", PASSWORD_DOCENTE)
    assert login is not None
    _set_session(app_db, login.rol, login.id_personal)

    app_db.execute(
        text(
            "INSERT INTO auditoria_calificacion "
            "(id_calificacion, id_personal_capturo, accion, valores_nuevos) "
            "VALUES (:id_cal, :id_propio, 'captura', '{}'::jsonb)"
        ),
        {"id_cal": calificacion["id_calificacion"], "id_propio": login.id_personal},
    )
    app_db.commit()


# --- Append-only: ni PUT ni DELETE existen en el router (verificado abajo
# por inspección de app.main), y auditoria_calificacion no tiene políticas
# RLS de UPDATE/DELETE en db/ddl_mvp.sql -- sin política, Postgres deniega
# por defecto (0 filas afectadas, para cualquier rol, sin excepción ni
# siquiera para admin). Confirmado directo contra la tabla, bypasseando
# el service, mismo rigor que el gap de Fase 4.


def test_auditoria_calificacion_put_does_not_exist_405(client, seed):
    # Append-only a nivel de API: ni siquiera admin tiene un endpoint para
    # editar el historial (mismo patrón que test_plantel_post_does_not_exist_405).
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.put("/auditoria-calificacion", headers=headers, json={})
    assert resp.status_code == 405


def test_auditoria_calificacion_delete_does_not_exist_405(client, seed):
    headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    resp = client.delete("/auditoria-calificacion", headers=headers)
    assert resp.status_code == 405


def test_auditoria_update_direct_blocked_for_all_roles(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )
    # app_db abre sin SET alguno (fail-closed): hay que autenticar como
    # admin antes de poder leer la fila para obtener su id.
    login_inicial = authenticate_personal(app_db, "admin1@sige.test", PASSWORD_ADMIN)
    assert login_inicial is not None
    _set_session(app_db, login_inicial.rol, login_inicial.id_personal)
    id_auditoria = app_db.execute(
        text("SELECT id_auditoria FROM auditoria_calificacion WHERE id_calificacion = :id"),
        {"id": calificacion["id_calificacion"]},
    ).scalar_one()
    app_db.commit()

    for email, password in (
        ("docente1@sige.test", PASSWORD_DOCENTE),
        ("directivo1@sige.test", PASSWORD_DIRECTIVO),
        ("admin1@sige.test", PASSWORD_ADMIN),
    ):
        login = authenticate_personal(app_db, email, password)
        assert login is not None
        _set_session(app_db, login.rol, login.id_personal)
        result = app_db.execute(
            text(
                "UPDATE auditoria_calificacion SET accion = 'correccion' "
                "WHERE id_auditoria = :id"
            ),
            {"id": id_auditoria},
        )
        assert result.rowcount == 0, f"{email} pudo modificar auditoria_calificacion"
        app_db.commit()

    # commit() termina la transacción y con ella el SET LOCAL del último
    # rol del loop (admin) -- hay que re-autenticar antes de esta lectura
    # final, si no la sesión queda sin rol (NULL) y RLS la niega también.
    _set_session(app_db, login_inicial.rol, login_inicial.id_personal)
    accion = app_db.execute(
        text("SELECT accion FROM auditoria_calificacion WHERE id_auditoria = :id"),
        {"id": id_auditoria},
    ).scalar_one()
    assert accion == "captura"


def test_auditoria_delete_direct_blocked_for_all_roles(client, seed, app_db):
    admin_headers = auth_headers(client, "admin1@sige.test", PASSWORD_ADMIN)
    id_docente = seed["ids"]["docente1@sige.test"]
    grupo_asignatura, alumno = _docente_alumno_grupo_asig(client, admin_headers, seed, id_docente)
    docente_headers = auth_headers(client, "docente1@sige.test", PASSWORD_DOCENTE)
    calificacion = _post_calificacion(
        client, docente_headers, alumno["id_alumno"], grupo_asignatura["id_grupo_asig"]
    )
    # app_db abre sin SET alguno (fail-closed): hay que autenticar como
    # admin antes de poder leer la fila para obtener su id.
    login_inicial = authenticate_personal(app_db, "admin1@sige.test", PASSWORD_ADMIN)
    assert login_inicial is not None
    _set_session(app_db, login_inicial.rol, login_inicial.id_personal)
    id_auditoria = app_db.execute(
        text("SELECT id_auditoria FROM auditoria_calificacion WHERE id_calificacion = :id"),
        {"id": calificacion["id_calificacion"]},
    ).scalar_one()
    app_db.commit()

    for email, password in (
        ("docente1@sige.test", PASSWORD_DOCENTE),
        ("directivo1@sige.test", PASSWORD_DIRECTIVO),
        ("admin1@sige.test", PASSWORD_ADMIN),
    ):
        login = authenticate_personal(app_db, email, password)
        assert login is not None
        _set_session(app_db, login.rol, login.id_personal)
        result = app_db.execute(
            text("DELETE FROM auditoria_calificacion WHERE id_auditoria = :id"),
            {"id": id_auditoria},
        )
        assert result.rowcount == 0, f"{email} pudo borrar de auditoria_calificacion"
        app_db.commit()

    # Mismo motivo que en el test de UPDATE: re-autenticar tras el commit
    # que cerró la transacción (y el SET LOCAL) del último rol del loop.
    _set_session(app_db, login_inicial.rol, login_inicial.id_personal)
    sigue_existiendo = app_db.execute(
        text("SELECT 1 FROM auditoria_calificacion WHERE id_auditoria = :id"),
        {"id": id_auditoria},
    ).first()
    assert sigue_existiendo is not None
