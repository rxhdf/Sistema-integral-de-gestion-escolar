FROM python:3.12-slim

WORKDIR /app

RUN useradd -m appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic.ini .
COPY --chown=appuser:appuser db/ddl_mvp.sql ./db/ddl_mvp.sql
COPY --chown=appuser:appuser db/migrations_snapshots/ ./db/migrations_snapshots/

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
