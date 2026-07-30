import os

# Unico DSN que debe usar el backend en runtime — el rol sige_app, sin
# privilegios de owner/superuser (ver ADR-006). Nunca DATABASE_URL_MIGRATIONS.
DATABASE_URL = os.environ["DATABASE_URL"]
