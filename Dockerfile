FROM python:3.12-slim

WORKDIR /app

RUN useradd -m appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto y el script de entrada
COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic.ini .
COPY --chown=appuser:appuser db/ddl_mvp.sql ./db/ddl_mvp.sql
COPY --chown=appuser:appuser db/migrations_snapshots/ ./db/migrations_snapshots/
COPY --chown=appuser:appuser docker-entrypoint.sh ./docker-entrypoint.sh

# Dar permisos de ejecución al entrypoint
RUN chmod +x ./docker-entrypoint.sh

USER appuser

# Usar el script como el comando de inicio
CMD ["./docker-entrypoint.sh"]