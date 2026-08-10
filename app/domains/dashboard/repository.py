from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.domains.academico.models import Asignatura, Grupo, GrupoAsignatura
from app.domains.alumnos.models import Alumno
from app.domains.control_escolar.models import Calificacion
from app.domains.organizacional.models import PeriodoSemestral
from app.domains.personal.models import Personal

# --- Directivo/admin: agregados de todo el plantel -------------------------


def matricula_total(db: Session) -> int:
    # vw_plantel_matricula_total (db/ddl_mvp.sql) ya filtra alumno.estatus =
    # 'activo'. Sin ORM propio para la vista y sin filtro por id_plantel:
    # MVP es de un solo plantel (docs/data_dictionary/mvp.md #1), mismo
    # patrón que organizacional/repository.py::get_plantel.
    row = db.execute(text("SELECT matricula_total FROM vw_plantel_matricula_total")).first()
    return row.matricula_total if row else 0


def grupos_activos(db: Session) -> int:
    return db.execute(
        select(func.count())
        .select_from(Grupo)
        .join(PeriodoSemestral, PeriodoSemestral.id_periodo == Grupo.id_periodo)
        .where(PeriodoSemestral.activo.is_(True))
    ).scalar_one()


def personal_activo(db: Session) -> int:
    # Personal tiene RLS (personal_select): directivo/admin ya ven todo el
    # plantel, así que este COUNT no necesita filtro adicional aparte de
    # estatus -- RLS es el mismo mecanismo que el resto de la API (ADR-006).
    return db.execute(
        select(func.count()).select_from(Personal).where(Personal.estatus == "activo")
    ).scalar_one()


def asignaturas_configuradas(db: Session) -> int:
    return db.execute(
        select(func.count()).select_from(Asignatura).where(Asignatura.activa.is_(True))
    ).scalar_one()


# --- Docente: agregados de su propio scope ----------------------------------
# Sin filtro explícito por id_docente en ninguna de las tres consultas: igual
# que control_escolar/repository.py::list_calificacion, se confía en las
# políticas RLS ya validadas (grupo_asignatura_select / alumno_select /
# calificacion_select) para acotar al docente autenticado.


def grupos_asignados_docente(db: Session) -> int:
    return db.execute(
        select(func.count(func.distinct(GrupoAsignatura.id_grupo)))
        .select_from(GrupoAsignatura)
        .join(PeriodoSemestral, PeriodoSemestral.id_periodo == GrupoAsignatura.id_periodo)
        .where(PeriodoSemestral.activo.is_(True))
    ).scalar_one()


def alumnos_bajo_responsabilidad_docente(db: Session) -> int:
    return db.execute(
        select(func.count(func.distinct(Alumno.id_alumno)))
        .select_from(Alumno)
        .where(Alumno.estatus == "activo")
    ).scalar_one()


def calificaciones_pendientes_docente(db: Session) -> int:
    # Un alumno cuenta una vez por cada grupo_asignatura (activa) en la que
    # le falta calificacion_final -- no se deduplica entre materias, cada
    # una es una acción pendiente distinta para el docente.
    return db.execute(
        select(func.count())
        .select_from(GrupoAsignatura)
        .join(PeriodoSemestral, PeriodoSemestral.id_periodo == GrupoAsignatura.id_periodo)
        .join(Alumno, Alumno.id_grupo == GrupoAsignatura.id_grupo)
        .outerjoin(
            Calificacion,
            and_(
                Calificacion.id_alumno == Alumno.id_alumno,
                Calificacion.id_grupo_asig == GrupoAsignatura.id_grupo_asig,
            ),
        )
        .where(
            PeriodoSemestral.activo.is_(True),
            Alumno.estatus == "activo",
            Calificacion.calificacion_final.is_(None),
        )
    ).scalar_one()
