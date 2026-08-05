from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Una transacción por request, comprometida al final (no en medio de
    un repository).

    set_config(..., is_local=true) en app/core/security.py fija
    app.current_rol/app.current_personal_id acotado a la transacción
    actual — si un repository hiciera su propio commit antes de terminar
    el request, esos valores se resetearían ahí mismo y cualquier query
    posterior en el mismo request (ej. el refresh() tras un INSERT) los
    vería en NULL, con RLS negando por fail-closed. Por eso el commit es
    responsabilidad única de esta dependencia, al cierre del request.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
