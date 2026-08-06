"""Fixtures compartidas: siembra datos como sige_migrator (bypassea RLS,
necesario para poblar sin depender de sesión ya autenticada — mismo patrón
que docs/validacion/rls-test-log-sige_app.md) y expone un TestClient que
sirve requests con la app real, es decir, con sige_app (DATABASE_URL) tal
como corre en producción/dev — nunca con el rol migrator.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_not_for_prod")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")

DATABASE_URL_MIGRATIONS = os.environ["DATABASE_URL_MIGRATIONS"]

_migrator_engine = create_engine(DATABASE_URL_MIGRATIONS)
_MigratorSession = sessionmaker(bind=_migrator_engine)

PASSWORD_DOCENTE = "docente-pass-1"
PASSWORD_DIRECTIVO = "directivo-pass-1"
PASSWORD_ADMIN = "admin-pass-1"
PASSWORD_DOCENTE_BAJA = "baja-pass-1"


@pytest.fixture()
def seed():
    """Limpia y siembra: 1 plantel, 1 ciclo activo, 1 periodo activo,
    4 personal (docente, docente dado de baja, directivo, admin).

    Function-scoped (no session-scoped): cada test parte de una BD limpia,
    así que las aserciones de conteo (ej. "la lista tiene N filas") no
    dependen del orden en que corran otros tests que también escriben.
    """
    from app.core.security import hash_password

    with _MigratorSession() as db:
        db.execute(
            text(
                # asignatura no tiene FK hacia ninguna de las otras 4 tablas
                # (ver db/ddl_mvp.sql #6) — TRUNCATE ... CASCADE solo alcanza
                # tablas hijas, así que hay que listarla explícita o sus filas
                # sobreviven entre tests y chocan por clave_asignatura unique.
                "TRUNCATE personal, periodo_semestral, ciclo_escolar, plantel, asignatura "
                "RESTART IDENTITY CASCADE"
            )
        )
        db.execute(
            text(
                "INSERT INTO plantel (clave_plantel, nombre_plantel, municipio, estado) "
                "VALUES ('PL-01', 'Plantel de prueba', 'Municipio', 'Estado') "
                "RETURNING id_plantel"
            )
        )
        id_plantel = db.execute(text("SELECT id_plantel FROM plantel")).scalar_one()

        db.execute(
            text(
                "INSERT INTO ciclo_escolar (nombre, fecha_inicio, fecha_fin, activo) "
                "VALUES ('2026-2027', '2026-08-01', '2027-07-31', true)"
            )
        )
        id_ciclo = db.execute(text("SELECT id_ciclo FROM ciclo_escolar")).scalar_one()

        db.execute(
            text(
                "INSERT INTO periodo_semestral "
                "(id_ciclo, clave_periodo, numero_periodo, fecha_inicio, fecha_fin, activo) "
                "VALUES (:id_ciclo, '2026A', 1, '2026-08-01', '2027-01-31', true)"
            ),
            {"id_ciclo": id_ciclo},
        )

        def insert_personal(curp, nombre, email, rol, password, estatus="activo"):
            db.execute(
                text(
                    "INSERT INTO personal "
                    "(id_plantel, curp, nombre, apellido_paterno, email_institucional, "
                    " password_hash, rol, estatus) "
                    "VALUES (:id_plantel, :curp, :nombre, 'Apellido', :email, "
                    " :password_hash, :rol, :estatus)"
                ),
                {
                    "id_plantel": id_plantel,
                    "curp": curp,
                    "nombre": nombre,
                    "email": email,
                    "password_hash": hash_password(password),
                    "rol": rol,
                    "estatus": estatus,
                },
            )

        insert_personal(
            "CURPDOCENTE000001", "Docente Uno", "docente1@sige.test", "docente", PASSWORD_DOCENTE
        )
        insert_personal(
            "CURPDOCBAJA000001",
            "Docente Baja",
            "docente.baja@sige.test",
            "docente",
            PASSWORD_DOCENTE_BAJA,
            estatus="baja",
        )
        insert_personal(
            "CURPDIRECTIVO0001",
            "Directivo Uno",
            "directivo1@sige.test",
            "directivo",
            PASSWORD_DIRECTIVO,
        )
        insert_personal(
            "CURPADMIN00000001", "Admin Uno", "admin1@sige.test", "admin", PASSWORD_ADMIN
        )
        db.commit()

        ids = dict(
            db.execute(
                text("SELECT email_institucional, id_personal FROM personal")
            ).all()
        )
        return {"id_plantel": id_plantel, "id_ciclo": id_ciclo, "ids": ids}


@pytest.fixture()
def client(seed):
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def migrator_db() -> Session:
    with _MigratorSession() as db:
        yield db


@pytest.fixture()
def app_db() -> Session:
    """Sesión sobre el mismo engine que usa la app en runtime (sige_app,
    DATABASE_URL) — para tests que ejercen RLS directamente sin pasar por
    el TestClient/HTTP."""
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        yield db


def get_token(client: TestClient, email: str, password: str) -> str:
    resp = client.post(
        "/auth/login", json={"email_institucional": email, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(client: TestClient, email: str, password: str) -> dict:
    return {"Authorization": f"Bearer {get_token(client, email, password)}"}
