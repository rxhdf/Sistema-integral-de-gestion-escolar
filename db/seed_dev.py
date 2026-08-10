"""Seed reproducible para desarrollo local — NUNCA correr contra producción.

Crea (o reutiliza si ya existen, vía ON CONFLICT DO NOTHING sobre cada
UNIQUE real) un plantel, un ciclo/periodo activos, 1 personal por rol con
credenciales de desarrollo conocidas, 1 grupo + 1 asignatura + su
grupo_asignatura asignada al docente de prueba, y 2 alumnos inscritos con
expediente académico — para que el dashboard y las pantallas de
alumnos/calificaciones del docente de prueba tengan datos reales que
mostrar, no ceros vacíos.

Reutiliza app/core/security.py::hash_password (mismo hashing que usa el
login real) en vez de generar el hash a mano en SQL. Corre como
sige_migrator (DATABASE_URL_MIGRATIONS) -- igual que tests/conftest.py --
porque bypassea RLS: sin sesión autenticada todavía, RLS de
personal/alumno/etc. denegaría el INSERT.

Uso: ver docs/dev/seed-credentials.md.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.security import hash_password  # noqa: E402

# --- Credenciales de desarrollo -- SOLO DESARROLLO, nunca producción -------
CREDENCIALES = {
    "docente": ("docente@cobao.edu.mx", "Docente123!"),
    "directivo": ("directivo@cobao.edu.mx", "Directivo123!"),
    "admin": ("admin@cobao.edu.mx", "Admin123!"),
}


def _curp_dev(etiqueta: str) -> str:
    # CURP es CHAR(18) NOT NULL UNIQUE en db/ddl_mvp.sql -- cualquier
    # string de 18 caracteres sirve para dev, no necesita ser un CURP real.
    curp = f"SEED{etiqueta.upper()}".ljust(18, "0")
    assert len(curp) == 18, curp
    return curp


def main() -> None:
    database_url = os.environ["DATABASE_URL_MIGRATIONS"]
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        db.execute(
            text(
                "INSERT INTO plantel (clave_plantel, nombre_plantel, municipio, estado) "
                "VALUES ('PL-DEV', 'Plantel de desarrollo', 'Oaxaca', 'Oaxaca') "
                "ON CONFLICT (clave_plantel) DO NOTHING"
            )
        )
        id_plantel = db.execute(
            text("SELECT id_plantel FROM plantel WHERE clave_plantel = 'PL-DEV'")
        ).scalar_one()

        # uq_ciclo_escolar_activo / uq_periodo_semestral_activo permiten un
        # solo activo=true a la vez -- si otra fila quedó activa (ej. datos
        # de un `pytest` corrido contra esta misma BD, que no limpia al
        # terminar), se desactiva antes de insertar la nuestra, para que el
        # script sea repetible sin importar qué corrió antes.
        db.execute(
            text("UPDATE ciclo_escolar SET activo = false WHERE activo = true AND nombre <> '2026-2027-DEV'")
        )
        db.execute(
            text(
                "INSERT INTO ciclo_escolar (nombre, fecha_inicio, fecha_fin, activo) "
                "VALUES ('2026-2027-DEV', '2026-08-01', '2027-07-31', true) "
                "ON CONFLICT (nombre) DO NOTHING"
            )
        )
        id_ciclo = db.execute(
            text("SELECT id_ciclo FROM ciclo_escolar WHERE nombre = '2026-2027-DEV'")
        ).scalar_one()

        db.execute(
            text("UPDATE periodo_semestral SET activo = false WHERE activo = true AND clave_periodo <> '2026A-DEV'")
        )
        db.execute(
            text(
                "INSERT INTO periodo_semestral "
                "(id_ciclo, clave_periodo, numero_periodo, fecha_inicio, fecha_fin, activo) "
                "VALUES (:id_ciclo, '2026A-DEV', 1, '2026-08-01', '2027-01-31', true) "
                "ON CONFLICT (clave_periodo) DO NOTHING"
            ),
            {"id_ciclo": id_ciclo},
        )
        id_periodo = db.execute(
            text("SELECT id_periodo FROM periodo_semestral WHERE clave_periodo = '2026A-DEV'")
        ).scalar_one()

        ids_personal = {}
        for rol, (email, password) in CREDENCIALES.items():
            db.execute(
                text(
                    "INSERT INTO personal "
                    "(id_plantel, curp, nombre, apellido_paterno, email_institucional, "
                    " password_hash, rol, estatus) "
                    "VALUES (:id_plantel, :curp, :nombre, 'Seed', :email, "
                    " :password_hash, :rol, 'activo') "
                    "ON CONFLICT (email_institucional) DO NOTHING"
                ),
                {
                    "id_plantel": id_plantel,
                    "curp": _curp_dev(rol),
                    "nombre": rol.capitalize(),
                    "email": email,
                    "password_hash": hash_password(password),
                    "rol": rol,
                },
            )
            ids_personal[rol] = db.execute(
                text("SELECT id_personal FROM personal WHERE email_institucional = :email"),
                {"email": email},
            ).scalar_one()

        db.execute(
            text(
                "INSERT INTO grupo (id_plantel, id_periodo, semestre, nombre_grupo) "
                "VALUES (:id_plantel, :id_periodo, 1, '1A-DEV') "
                "ON CONFLICT (id_plantel, id_periodo, nombre_grupo) DO NOTHING"
            ),
            {"id_plantel": id_plantel, "id_periodo": id_periodo},
        )
        id_grupo = db.execute(
            text(
                "SELECT id_grupo FROM grupo "
                "WHERE id_plantel = :id_plantel AND id_periodo = :id_periodo "
                "AND nombre_grupo = '1A-DEV'"
            ),
            {"id_plantel": id_plantel, "id_periodo": id_periodo},
        ).scalar_one()

        db.execute(
            text(
                "INSERT INTO asignatura (clave_asignatura, nombre, semestre, activa) "
                "VALUES ('MAT-DEV', 'Matemáticas (seed dev)', 1, true) "
                "ON CONFLICT (clave_asignatura) DO NOTHING"
            )
        )
        id_asignatura = db.execute(
            text("SELECT id_asignatura FROM asignatura WHERE clave_asignatura = 'MAT-DEV'")
        ).scalar_one()

        db.execute(
            text(
                "INSERT INTO grupo_asignatura (id_grupo, id_asignatura, id_docente, id_periodo) "
                "VALUES (:id_grupo, :id_asignatura, :id_docente, :id_periodo) "
                "ON CONFLICT (id_grupo, id_asignatura, id_periodo) DO NOTHING"
            ),
            {
                "id_grupo": id_grupo,
                "id_asignatura": id_asignatura,
                "id_docente": ids_personal["docente"],
                "id_periodo": id_periodo,
            },
        )

        for n in (1, 2):
            matricula = f"SEED-ALU-{n:04d}"
            db.execute(
                text(
                    "INSERT INTO alumno "
                    "(id_plantel, id_grupo, matricula, curp, nombre, apellido_paterno, "
                    " fecha_nacimiento, sexo, estatus, fecha_inscripcion) "
                    "VALUES (:id_plantel, :id_grupo, :matricula, :curp, :nombre, 'Seed', "
                    " '2009-01-01', 'M', 'activo', '2026-08-01') "
                    "ON CONFLICT (matricula) DO NOTHING"
                ),
                {
                    "id_plantel": id_plantel,
                    "id_grupo": id_grupo,
                    "matricula": matricula,
                    "curp": _curp_dev(f"ALUMNO{n}"),
                    "nombre": f"Alumno{n}",
                },
            )
            id_alumno = db.execute(
                text("SELECT id_alumno FROM alumno WHERE matricula = :matricula"),
                {"matricula": matricula},
            ).scalar_one()

            db.execute(
                text(
                    "INSERT INTO expediente_academico (id_alumno, situacion_academica) "
                    "VALUES (:id_alumno, 'regular') "
                    "ON CONFLICT (id_alumno) DO NOTHING"
                ),
                {"id_alumno": id_alumno},
            )

        db.commit()

    print("Seed de desarrollo aplicado. Credenciales en docs/dev/seed-credentials.md.")


if __name__ == "__main__":
    main()
