"""log_acceso table + RLS, fn_registrar_intento_login (Gestion de Cuentas, Pieza 3, ADR-011)

Agrega la tabla `log_acceso` (docs/data_dictionary/gestion-cuentas.md,
Pieza 3, diseno cerrado): historial completo de intentos de login, exitosos
y fallidos. NUNCA guarda la contrasena intentada, en ninguna forma.

RLS: solo admin lee (log_acceso_select). Sin politicas de
INSERT/UPDATE/DELETE -- Postgres deniega esas operaciones por defecto a
sige_app (no es owner/superuser) aunque tenga GRANT de tabla via
ALTER DEFAULT PRIVILEGES (ADR-006); el unico camino de escritura es
fn_registrar_intento_login, SECURITY DEFINER, mismo patron que
fn_login_lookup (ADR-007) -- corre con los privilegios de su owner
(sige_migrator) y por eso puede insertar pese a que sige_app no tiene
ninguna politica RLS que se lo permita directamente. Tabla inmutable
ademas (sin UPDATE/DELETE), mismo patron que auditoria_calificacion /
reporte_incidencia.

ADR-011 documenta por que se eligio una funcion SEPARADA de
fn_login_lookup en vez de ampliar esa (opcion (a) del diccionario de
datos): fn_login_lookup esta documentada en ADR-007 como "solo lectura,
LANGUAGE sql, no puede contener ninguna sentencia de escritura por
construccion del lenguaje" -- una propiedad de diseno explicita que no
se debe romper sin abrir esa discusion aparte. Ademas fn_login_lookup
filtra estatus='activo' en su propio WHERE, por lo que nunca revela si
una cuenta inactiva existe; fn_registrar_intento_login SI necesita esa
distincion para poblar motivo_fallo correctamente
(credenciales_invalidas / cuenta_bloqueada / cuenta_baja), asi que hace
su propia lectura interna de personal (bypasseando RLS como
SECURITY DEFINER, igual que fn_login_lookup) en vez de recibir mas
parametros desde Python.

Revision ID: 23e24f6cd81d
Revises: 6ccb09ee0faa
Create Date: 2026-08-16 00:00:00.000001

"""
from typing import Sequence, Union

from alembic import op

revision: str = '23e24f6cd81d'
down_revision: Union[str, Sequence[str], None] = '6ccb09ee0faa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CREATE_TABLE = """
CREATE TABLE log_acceso (
    id_log          SERIAL PRIMARY KEY,
    email_intentado VARCHAR(100) NOT NULL,
    id_personal     INT REFERENCES personal(id_personal),
    exitoso         BOOLEAN NOT NULL,
    motivo_fallo    VARCHAR(50),
    fecha_intento   TIMESTAMP NOT NULL DEFAULT now()
);
"""

_CREATE_INDEXES = """
CREATE INDEX idx_log_acceso_id_personal ON log_acceso (id_personal);
CREATE INDEX idx_log_acceso_fecha_intento ON log_acceso (fecha_intento DESC);
"""

_ENABLE_RLS = "ALTER TABLE log_acceso ENABLE ROW LEVEL SECURITY;"

_CREATE_POLICY = """
CREATE POLICY log_acceso_select ON log_acceso
    FOR SELECT
    USING (app_current_rol() = 'admin');
"""

_CREATE_FN = """
CREATE OR REPLACE FUNCTION fn_registrar_intento_login(p_email VARCHAR(100), p_exitoso BOOLEAN)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_personal INT;
    v_estatus     VARCHAR(20);
    v_motivo      VARCHAR(50);
BEGIN
    SELECT id_personal, estatus INTO v_id_personal, v_estatus
    FROM personal
    WHERE email_institucional = p_email;

    IF NOT p_exitoso THEN
        IF v_id_personal IS NULL THEN
            v_motivo := 'credenciales_invalidas';
        ELSIF v_estatus = 'bloqueado' THEN
            v_motivo := 'cuenta_bloqueada';
        ELSIF v_estatus = 'baja' THEN
            v_motivo := 'cuenta_baja';
        ELSE
            v_motivo := 'credenciales_invalidas';
        END IF;
    END IF;

    INSERT INTO log_acceso (email_intentado, id_personal, exitoso, motivo_fallo)
    VALUES (p_email, v_id_personal, p_exitoso, v_motivo);
END;
$$;
"""

_REVOKE_PUBLIC = "REVOKE ALL ON FUNCTION fn_registrar_intento_login(VARCHAR, BOOLEAN) FROM PUBLIC;"
_GRANT_APP = "GRANT EXECUTE ON FUNCTION fn_registrar_intento_login(VARCHAR, BOOLEAN) TO sige_app;"

_DROP_FN = "DROP FUNCTION IF EXISTS fn_registrar_intento_login(VARCHAR, BOOLEAN);"
_DROP_TABLE = "DROP TABLE IF EXISTS log_acceso;"


def upgrade() -> None:
    op.execute(_CREATE_TABLE)
    op.execute(_CREATE_INDEXES)
    op.execute(_ENABLE_RLS)
    op.execute(_CREATE_POLICY)
    op.execute(_CREATE_FN)
    op.execute(_REVOKE_PUBLIC)
    op.execute(_GRANT_APP)


def downgrade() -> None:
    op.execute(_DROP_FN)
    # DROP TABLE ya elimina indices, constraints y politicas RLS de la
    # tabla junto con ella -- no hace falta un DROP POLICY/INDEX aparte.
    op.execute(_DROP_TABLE)
