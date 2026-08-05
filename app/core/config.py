import os

# Unico DSN que debe usar el backend en runtime — el rol sige_app, sin
# privilegios de owner/superuser (ver ADR-006). Nunca DATABASE_URL_MIGRATIONS.
DATABASE_URL = os.environ["DATABASE_URL"]

# Firma de los JWT emitidos en /auth/login (app/core/security.py). Sin
# default: un secreto adivinable en producción invalida todo el esquema de
# auth, así que su ausencia debe tronar al arrancar, no degradar en silencio.
# docker-compose interpola una variable no definida como string vacío (no
# como ausente), así que un `os.environ[...]` solo no basta: se valida
# también que no esté vacía.
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY está vacía — debe traer un valor real")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "60"))
