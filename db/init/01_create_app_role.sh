#!/usr/bin/env bash
# Fase 0 / ADR-006: crea el rol de runtime (sige_app) al inicializar el
# volumen de Postgres. Corre una sola vez, como el rol de bootstrap
# (POSTGRES_USER = sige_migrator, ya creado por el entrypoint oficial de
# la imagen con privilegios de owner/superuser sobre POSTGRES_DB).
#
# sige_migrator nunca lo usa el backend en runtime — solo Alembic
# (DATABASE_URL_MIGRATIONS). El backend solo conoce a sige_app
# (DATABASE_URL), que es NOSUPERUSER y no es owner de ninguna tabla, para
# que las políticas RLS de db/ddl_mvp.sql se apliquen de verdad.
set -euo pipefail

: "${DB_APP_USER:?falta DB_APP_USER en el entorno del contenedor db}"
: "${DB_APP_PASSWORD:?falta DB_APP_PASSWORD en el entorno del contenedor db}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE "${DB_APP_USER}" LOGIN PASSWORD '${DB_APP_PASSWORD}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

    GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO "${DB_APP_USER}";
    GRANT USAGE ON SCHEMA public TO "${DB_APP_USER}";

    -- Cubre las tablas que ya existen al momento de correr este script.
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${DB_APP_USER}";
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${DB_APP_USER}";

    -- Cubre las tablas que cree sige_migrator después (futuras migraciones
    -- de Alembic), para que nunca quede una tabla sin GRANT a sige_app.
    ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${DB_APP_USER}";
    ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO "${DB_APP_USER}";
EOSQL
