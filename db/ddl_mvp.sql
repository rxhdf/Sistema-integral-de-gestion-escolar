-- =====================================================================
-- SIGE MVP — DDL completo
-- Fuente: docs/data-dictionary/mvp.md + docs/rbac/matriz-rbac-mvp.md
--         + ADR-001 a ADR-005
-- Orden de creación: respeta dependencia real de FKs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLANTEL
-- ---------------------------------------------------------------------
CREATE TABLE plantel (
    id_plantel      SERIAL PRIMARY KEY,
    clave_plantel   VARCHAR(20) NOT NULL UNIQUE,
    nombre_plantel  VARCHAR(200) NOT NULL,
    municipio       VARCHAR(100) NOT NULL,
    estado          VARCHAR(80) NOT NULL,
    domicilio       VARCHAR(300),
    telefono        VARCHAR(20),
    email           VARCHAR(100),
    estatus         VARCHAR(20) NOT NULL DEFAULT 'activo'
);

-- ---------------------------------------------------------------------
-- 2. CICLO_ESCOLAR
-- ---------------------------------------------------------------------
CREATE TABLE ciclo_escolar (
    id_ciclo        SERIAL PRIMARY KEY,
    nombre          VARCHAR(20) NOT NULL UNIQUE,
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT chk_ciclo_fechas CHECK (fecha_fin > fecha_inicio)
);

-- Garantiza que solo un ciclo esté activo a la vez (índice parcial único)
CREATE UNIQUE INDEX uq_ciclo_escolar_activo
    ON ciclo_escolar (activo)
    WHERE activo = true;

-- ---------------------------------------------------------------------
-- 3. PERIODO_SEMESTRAL
-- ---------------------------------------------------------------------
CREATE TABLE periodo_semestral (
    id_periodo      SERIAL PRIMARY KEY,
    id_ciclo        INT NOT NULL REFERENCES ciclo_escolar(id_ciclo),
    clave_periodo   VARCHAR(10) NOT NULL UNIQUE,
    numero_periodo  SMALLINT NOT NULL CHECK (numero_periodo IN (1, 2)),
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT chk_periodo_fechas CHECK (fecha_fin > fecha_inicio),
    CONSTRAINT uq_periodo_ciclo_numero UNIQUE (id_ciclo, numero_periodo)
);

CREATE UNIQUE INDEX uq_periodo_semestral_activo
    ON periodo_semestral (activo)
    WHERE activo = true;

-- ---------------------------------------------------------------------
-- 4. PERSONAL
-- ADR-003: rol colapsado en un solo campo (docente / directivo / admin)
-- ---------------------------------------------------------------------
CREATE TABLE personal (
    id_personal         SERIAL PRIMARY KEY,
    id_plantel          INT NOT NULL REFERENCES plantel(id_plantel),
    curp                CHAR(18) NOT NULL UNIQUE,
    nombre              VARCHAR(80) NOT NULL,
    apellido_paterno    VARCHAR(60) NOT NULL,
    apellido_materno    VARCHAR(60),
    email_institucional VARCHAR(100) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    rol                 VARCHAR(20) NOT NULL CHECK (rol IN ('docente', 'directivo', 'admin')),
    telefono            VARCHAR(20),
    fecha_ingreso       DATE,
    estatus             VARCHAR(20) NOT NULL DEFAULT 'activo'
);

-- ---------------------------------------------------------------------
-- 5. GRUPO
-- Nota: num_alumnos_inscritos NO es columna (ver ADR heredado del punto 1
-- del modelo lógico completo) — se calcula vía vista, ver al final del archivo.
-- ---------------------------------------------------------------------
CREATE TABLE grupo (
    id_grupo            SERIAL PRIMARY KEY,
    id_plantel          INT NOT NULL REFERENCES plantel(id_plantel),
    id_periodo          INT NOT NULL REFERENCES periodo_semestral(id_periodo),
    semestre            SMALLINT NOT NULL CHECK (semestre BETWEEN 1 AND 6),
    nombre_grupo        VARCHAR(10) NOT NULL,
    capacidad_maxima    INT,
    CONSTRAINT uq_grupo_nombre_periodo UNIQUE (id_plantel, id_periodo, nombre_grupo)
);

-- ---------------------------------------------------------------------
-- 6. ASIGNATURA
-- ---------------------------------------------------------------------
CREATE TABLE asignatura (
    id_asignatura   SERIAL PRIMARY KEY,
    clave_asignatura VARCHAR(20) NOT NULL UNIQUE,
    nombre          VARCHAR(120) NOT NULL,
    semestre        SMALLINT NOT NULL CHECK (semestre BETWEEN 1 AND 6),
    activa          BOOLEAN NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------
-- 7. GRUPO_ASIGNATURA
-- Punto de control central: ancla de toda CALIFICACION.
-- ---------------------------------------------------------------------
CREATE TABLE grupo_asignatura (
    id_grupo_asig   SERIAL PRIMARY KEY,
    id_grupo        INT NOT NULL REFERENCES grupo(id_grupo),
    id_asignatura   INT NOT NULL REFERENCES asignatura(id_asignatura),
    id_docente      INT NOT NULL REFERENCES personal(id_personal),
    id_periodo      INT NOT NULL REFERENCES periodo_semestral(id_periodo),
    CONSTRAINT uq_grupo_asignatura_periodo UNIQUE (id_grupo, id_asignatura, id_periodo)
    -- Pendiente confirmado en diccionario de datos: validar con plantel piloto
    -- si un grupo puede tener 2 docentes para la misma materia (partición).
    -- Si aplica, cambiar a UNIQUE (id_grupo, id_asignatura, id_periodo, id_docente).
);

-- Validación de que id_docente tenga rol = 'docente' (no se puede expresar
-- como CHECK simple entre tablas en Postgres estándar; se aplica vía
-- trigger, ya que es una regla de integridad de datos, no de RBAC).
CREATE OR REPLACE FUNCTION fn_valida_rol_docente()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM personal
        WHERE id_personal = NEW.id_docente AND rol = 'docente'
    ) THEN
        RAISE EXCEPTION 'id_docente (%) debe referenciar a un registro de personal con rol = docente', NEW.id_docente;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_valida_rol_docente
    BEFORE INSERT OR UPDATE ON grupo_asignatura
    FOR EACH ROW EXECUTE FUNCTION fn_valida_rol_docente();

-- ---------------------------------------------------------------------
-- 8. ALUMNO
-- ---------------------------------------------------------------------
CREATE TABLE alumno (
    id_alumno           SERIAL PRIMARY KEY,
    id_plantel          INT NOT NULL REFERENCES plantel(id_plantel),
    id_grupo            INT REFERENCES grupo(id_grupo),
    matricula           VARCHAR(20) NOT NULL UNIQUE,
    curp                CHAR(18) NOT NULL UNIQUE,
    nombre              VARCHAR(80) NOT NULL,
    apellido_paterno    VARCHAR(60) NOT NULL,
    apellido_materno    VARCHAR(60),
    fecha_nacimiento    DATE NOT NULL,
    sexo                CHAR(1),
    email               VARCHAR(100),
    telefono_personal   VARCHAR(20),
    estatus             VARCHAR(20) NOT NULL DEFAULT 'activo',
    fecha_inscripcion   DATE NOT NULL,
    fecha_baja          DATE
);

-- ---------------------------------------------------------------------
-- 9. EXPEDIENTE_ACADEMICO
-- ADR-001: tabla separada de Alumno para RLS granular.
-- ADR-005: promedio_actual se calcula en el service, no en BD.
-- ---------------------------------------------------------------------
CREATE TABLE expediente_academico (
    id_exp_academico    SERIAL PRIMARY KEY,
    id_alumno           INT NOT NULL UNIQUE REFERENCES alumno(id_alumno),
    escuela_procedencia VARCHAR(200),
    promedio_secundaria DECIMAL(4,2),
    promedio_actual     DECIMAL(4,2),
    situacion_academica VARCHAR(20) NOT NULL DEFAULT 'regular'
        CHECK (situacion_academica IN ('regular', 'irregular', 'condicionado'))
);

-- ---------------------------------------------------------------------
-- 10. CALIFICACION
-- ADR-005: calificacion_final y estatus se calculan en el service.
-- ---------------------------------------------------------------------
CREATE TABLE calificacion (
    id_calificacion     SERIAL PRIMARY KEY,
    id_alumno           INT NOT NULL REFERENCES alumno(id_alumno),
    id_grupo_asig       INT NOT NULL REFERENCES grupo_asignatura(id_grupo_asig),
    parcial_1           DECIMAL(4,1) CHECK (parcial_1 BETWEEN 0 AND 10),
    parcial_2           DECIMAL(4,1) CHECK (parcial_2 BETWEEN 0 AND 10),
    parcial_3           DECIMAL(4,1) CHECK (parcial_3 BETWEEN 0 AND 10),
    calificacion_final  DECIMAL(4,1) CHECK (calificacion_final BETWEEN 0 AND 10),
    tipo_evaluacion     VARCHAR(20) NOT NULL DEFAULT 'ordinaria'
        CHECK (tipo_evaluacion IN ('ordinaria', 'extraordinaria')),
    estatus             VARCHAR(15) NOT NULL DEFAULT 'pendiente'
        CHECK (estatus IN ('aprobado', 'reprobado', 'pendiente')),
    fecha_captura       TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_calificacion_alumno_grupo_asig UNIQUE (id_alumno, id_grupo_asig)
);

-- ---------------------------------------------------------------------
-- 11. AUDITORIA_CALIFICACION
-- ADR-004: distingue quién capturó vs. quién modificó (directivo/admin
-- pueden corregir calificaciones ya capturadas por el docente original).
-- Append-only: sin UPDATE ni DELETE permitido a nivel de aplicación.
-- ---------------------------------------------------------------------
CREATE TABLE auditoria_calificacion (
    id_auditoria            SERIAL PRIMARY KEY,
    id_calificacion         INT NOT NULL REFERENCES calificacion(id_calificacion),
    id_personal_capturo     INT REFERENCES personal(id_personal),
    id_personal_modifico    INT REFERENCES personal(id_personal),
    accion                  VARCHAR(20) NOT NULL CHECK (accion IN ('captura', 'correccion')),
    valores_anteriores      JSONB,
    valores_nuevos          JSONB,
    fecha_evento            TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 12. ASISTENCIA (post-MVP, primera feature nueva — ver ADR-008 y
-- docs/data_dictionary/asistencia.md, diseño cerrado en sesión).
-- Registro por sesión individual: una fila por alumno x grupo_asignatura
-- x fecha de clase. Captura en lote desde el service (un POST inserta
-- todas las filas del grupo de una vez, en una sola transacción), pero
-- el UNIQUE de abajo aplica por fila, no por lote.
-- ---------------------------------------------------------------------
CREATE TABLE asistencia (
    id_asistencia        SERIAL PRIMARY KEY,
    id_alumno            INT NOT NULL REFERENCES alumno(id_alumno),
    id_grupo_asig        INT NOT NULL REFERENCES grupo_asignatura(id_grupo_asig),
    fecha_sesion         DATE NOT NULL,
    estado               VARCHAR(10) NOT NULL CHECK (estado IN ('presente', 'ausente', 'retardo')),
    id_personal_registro INT NOT NULL REFERENCES personal(id_personal),
    fecha_captura        TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_asistencia_alumno_grupo_asig_fecha UNIQUE (id_alumno, id_grupo_asig, fecha_sesion)
);

-- Índices de rendimiento (no de integridad -- el UNIQUE de arriba ya
-- cubre el caso de integridad, y de paso indexa (id_alumno, id_grupo_asig,
-- fecha_sesion) en ese orden, pero no sirve para "todas las faltas de
-- este alumno" ni para "la sesión de este grupo hoy" por sí solo).
CREATE INDEX idx_asistencia_alumno_periodo ON asistencia (id_alumno);
CREATE INDEX idx_asistencia_grupo_fecha ON asistencia (id_grupo_asig, fecha_sesion);

-- =====================================================================
-- VISTAS CALCULADAS (evitan columnas mantenidas a mano — ver ADR heredado)
-- =====================================================================

-- security_invoker = true (Postgres 15+): sin esto, la vista evalua RLS con
-- los privilegios del owner (sige_migrator, tambien owner de `alumno`), que
-- bypassea RLS por ser owner -- una consulta directa a la vista (sin pasar
-- por el service) veia el conteo real de TODO el plantel sin importar el rol
-- de sesion. Con security_invoker, la vista hereda alumno_select tal cual
-- (docente acotado a sus propios grupos; directivo/admin sin restriccion),
-- sin necesidad de RLS propio en plantel/grupo (ver nota mas abajo).
CREATE OR REPLACE VIEW vw_grupo_num_alumnos
WITH (security_invoker = true) AS
SELECT g.id_grupo, COUNT(a.id_alumno) AS num_alumnos_inscritos
FROM grupo g
LEFT JOIN alumno a ON a.id_grupo = g.id_grupo AND a.estatus = 'activo'
GROUP BY g.id_grupo;

CREATE OR REPLACE VIEW vw_plantel_matricula_total
WITH (security_invoker = true) AS
SELECT p.id_plantel, COUNT(a.id_alumno) AS matricula_total
FROM plantel p
LEFT JOIN alumno a ON a.id_plantel = p.id_plantel AND a.estatus = 'activo'
GROUP BY p.id_plantel;

-- =====================================================================
-- ROW-LEVEL SECURITY — traducido de docs/rbac/matriz-rbac-mvp.md
-- =====================================================================
-- Convención: el backend, al abrir la sesión de BD tras autenticar el JWT,
-- ejecuta:
--   SET app.current_personal_id = '<id_personal>';
--   SET app.current_rol = '<docente|directivo|admin>';
--   SET app.current_plantel_id = '<id_plantel>';
-- Estas políticas asumen esa convención.
--
-- current_setting('app.x') SIN el segundo argumento lanza
-- "unrecognized configuration parameter" si la sesión nunca hizo SET (ej.
-- conexión directa por psql, script de mantenimiento, o bug en el backend
-- que no inyectó la sesión) — un error 500 en vez de una denegación de
-- acceso limpia. Se usa current_setting(name, true) (missing_ok), que
-- devuelve NULL en ese caso; las comparaciones con NULL son NULL/false en
-- USING y WITH CHECK, o sea deniegan por defecto (fail-closed).
CREATE OR REPLACE FUNCTION app_current_rol() RETURNS TEXT AS $$
    SELECT current_setting('app.current_rol', true);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_personal_id() RETURNS INT AS $$
    SELECT NULLIF(current_setting('app.current_personal_id', true), '')::INT;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- PERSONAL: docente ve solo su propio registro; directivo/admin ven todo
-- el plantel. Solo admin puede escribir (crear/editar/dar de baja).
-- ---------------------------------------------------------------------
ALTER TABLE personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY personal_select ON personal
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_personal = app_current_personal_id()
    );

CREATE POLICY personal_insert ON personal
    FOR INSERT
    WITH CHECK (app_current_rol() = 'admin');

CREATE POLICY personal_update ON personal
    FOR UPDATE
    USING (app_current_rol() = 'admin')
    WITH CHECK (app_current_rol() = 'admin');

CREATE POLICY personal_delete ON personal
    FOR DELETE
    USING (app_current_rol() = 'admin');

-- ---------------------------------------------------------------------
-- GRUPO_ASIGNATURA: docente ve solo las suyas; directivo/admin ven y
-- escriben todas las del plantel.
-- ---------------------------------------------------------------------
ALTER TABLE grupo_asignatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY grupo_asignatura_select ON grupo_asignatura
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_docente = app_current_personal_id()
    );

CREATE POLICY grupo_asignatura_write ON grupo_asignatura
    FOR ALL
    USING (app_current_rol() IN ('directivo', 'admin'))
    WITH CHECK (app_current_rol() IN ('directivo', 'admin'));

-- ---------------------------------------------------------------------
-- CALIFICACION: docente C-R-U solo de sus grupo_asignatura;
-- directivo/admin R-U de todo el plantel (ADR-004: sí pueden corregir).
-- ---------------------------------------------------------------------
ALTER TABLE calificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY calificacion_select ON calificacion
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );

CREATE POLICY calificacion_insert ON calificacion
    FOR INSERT
    WITH CHECK (
        app_current_rol() = 'docente'
        AND id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );

CREATE POLICY calificacion_update ON calificacion
    FOR UPDATE
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );

-- ---------------------------------------------------------------------
-- EXPEDIENTE_ACADEMICO: docente lee (con promedio general, según lo
-- confirmado); directivo/admin C-R-U completo.
-- ---------------------------------------------------------------------
ALTER TABLE expediente_academico ENABLE ROW LEVEL SECURITY;

-- Mismo scope de fila que alumno_select (docente solo ve expedientes de
-- alumnos en grupos donde tiene grupo_asignatura activa) -- ADR-001 exige
-- que un docente "nunca tenga ni la posibilidad" de leer datos ajenos vía
-- RLS, no solo que el service los filtre. El filtro de campo sensible
-- (Nivel 3 de la matriz) se sigue aplicando en el schema Pydantic; esto
-- filtra filas, no columnas.
CREATE POLICY expediente_academico_select ON expediente_academico
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_alumno IN (
            SELECT a.id_alumno FROM alumno a
            JOIN grupo_asignatura ga ON ga.id_grupo = a.id_grupo
            WHERE ga.id_docente = app_current_personal_id()
        )
    );

CREATE POLICY expediente_academico_write ON expediente_academico
    FOR ALL
    USING (app_current_rol() IN ('directivo', 'admin'))
    WITH CHECK (app_current_rol() IN ('directivo', 'admin'));

-- ---------------------------------------------------------------------
-- ALUMNO: docente ve solo alumnos de sus grupos con asignatura activa;
-- directivo/admin ven y escriben todo el plantel.
-- Nota: el ocultamiento de campos (curp visible, email/telefono/fecha_nac
-- ocultos para docente) se aplica en el schema Pydantic de respuesta
-- (Nivel 3 de la matriz), no en RLS — RLS filtra filas, no columnas.
-- ---------------------------------------------------------------------
ALTER TABLE alumno ENABLE ROW LEVEL SECURITY;

CREATE POLICY alumno_select ON alumno
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo IN (
            SELECT ga.id_grupo FROM grupo_asignatura ga
            WHERE ga.id_docente = app_current_personal_id()
        )
    );

CREATE POLICY alumno_write ON alumno
    FOR ALL
    USING (app_current_rol() IN ('directivo', 'admin'))
    WITH CHECK (app_current_rol() IN ('directivo', 'admin'));

-- ---------------------------------------------------------------------
-- AUDITORIA_CALIFICACION: solo lectura para directivo/admin; sin acceso
-- para docente. Append-only — no se exponen políticas de UPDATE/DELETE
-- a ningún rol vía API (solo el usuario de servicio del backend inserta).
-- ---------------------------------------------------------------------
ALTER TABLE auditoria_calificacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY auditoria_calificacion_select ON auditoria_calificacion
    FOR SELECT
    USING (app_current_rol() IN ('directivo', 'admin'));

-- WITH CHECK(true) original permitía que cualquier sesión autenticada
-- (docente incluido) insertara una fila de auditoría suplantando a
-- cualquier id_personal_capturo/modifico -- el mismo patrón "el service
-- filtra pero RLS no" corregido en expediente_academico (Fase 4). El
-- control de QUÉ transición de calificacion amerita el registro sigue
-- viviendo en el service (ADR-005); esto solo impide que alguien pueda
-- mentir sobre QUIÉN hizo la acción.
CREATE POLICY auditoria_calificacion_insert ON auditoria_calificacion
    FOR INSERT
    WITH CHECK (
        CASE accion
            WHEN 'captura'    THEN id_personal_capturo  = app_current_personal_id()
            WHEN 'correccion' THEN id_personal_modifico = app_current_personal_id()
        END
    );

-- ---------------------------------------------------------------------
-- ASISTENCIA: mismo patrón de scope que CALIFICACION, con una diferencia
-- deliberada de matriz (docs/data_dictionary/asistencia.md): solo
-- docente puede CAPTURAR (INSERT) -- directivo/admin nunca insertan,
-- solo corrigen (UPDATE) lo ya capturado por el docente. calificacion sí
-- permite directivo/admin en el mismo nivel de acceso que docente para
-- lectura, pero para insert ambos esquemas coinciden: FOR INSERT exige
-- rol = 'docente' en los dos casos.
--
-- asistencia_update no tiene WITH CHECK, igual que calificacion_update:
-- el service solo cambia `estado`/`fecha_captura` sobre una fila ya
-- existente (nunca reasigna id_alumno/id_grupo_asig/fecha_sesion), así
-- que basta con USING para decidir qué filas son visibles/editables.
-- "docente solo corrige lo que él mismo capturó" (matriz RBAC Nivel 1)
-- coincide en la práctica con "docente solo corrige su propio
-- grupo_asignatura" mientras exista un único docente por
-- grupo_asignatura (UNIQUE en grupo_asignatura, pendiente de negocio si
-- eso cambia -- ver CLAUDE.md) — si se permite más de un docente por
-- grupo_asignatura en el futuro, esta política debe revisarse para
-- comparar contra id_personal_registro explícitamente, no solo contra
-- id_docente de grupo_asignatura.
-- ---------------------------------------------------------------------
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY asistencia_select ON asistencia
    FOR SELECT
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );

-- id_personal_registro = app_current_personal_id() en el WITH CHECK:
-- mismo motivo anti-suplantación que auditoria_calificacion_insert --
-- un docente no puede insertar una fila y adjudicarle la captura a otro
-- id_personal, aunque el id_grupo_asig sí sea suyo.
CREATE POLICY asistencia_insert ON asistencia
    FOR INSERT
    WITH CHECK (
        app_current_rol() = 'docente'
        AND id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
        AND id_personal_registro = app_current_personal_id()
    );

CREATE POLICY asistencia_update ON asistencia
    FOR UPDATE
    USING (
        app_current_rol() IN ('directivo', 'admin')
        OR id_grupo_asig IN (
            SELECT id_grupo_asig FROM grupo_asignatura
            WHERE id_docente = app_current_personal_id()
        )
    );

-- ---------------------------------------------------------------------
-- Resto de tablas (PLANTEL, CICLO_ESCOLAR, PERIODO_SEMESTRAL, GRUPO,
-- ASIGNATURA): sin RLS por fila (todo el contenido es del único plantel
-- del MVP), pero si se filtran por rol a nivel de escritura vía checks
-- en el service, no en BD, dado su bajo riesgo relativo. Revisar si se
-- requiere RLS explícito al expandir a más de un plantel.
-- =====================================================================

-- =====================================================================
-- LOGIN LOOKUP — ADR-007
-- Excepción puntual y acotada a RLS de `personal`: el login necesita leer
-- la fila por email ANTES de que exista sesión (app.current_rol /
-- app.current_personal_id), momento en el que personal_select siempre
-- deniega (fail-closed). Ver ADR-007 para el razonamiento completo — esta
-- función NO es un patrón a reutilizar para otros casos sin la misma
-- discusión.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_login_lookup(p_email VARCHAR(100))
RETURNS TABLE (
    id_personal     INT,
    rol             VARCHAR(20),
    password_hash   VARCHAR(255),
    estatus         VARCHAR(20)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
    SELECT p.id_personal, p.rol, p.password_hash, p.estatus
    FROM personal p
    WHERE p.email_institucional = p_email
      AND p.estatus = 'activo';
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una función;
-- se revoca y se otorga explícitamente solo a sige_app (ADR-007).
REVOKE ALL ON FUNCTION fn_login_lookup(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_login_lookup(VARCHAR) TO sige_app;

-- =====================================================================
-- RECALCULO DE PROMEDIO_ACTUAL — ADR-005, gap encontrado en Fase 5
-- Excepción puntual y acotada a RLS de expediente_academico, mismo
-- patrón que ADR-007: expediente_academico_write restringe UPDATE a
-- directivo/admin (Nivel 1 de la matriz: docente solo tiene R sobre
-- Expediente_Academico) -- correcto para los campos que un humano edita
-- a mano. Pero ADR-005 exige que el service recalcule promedio_actual
-- automáticamente en CADA captura/corrección de Calificacion, y la más
-- común es un docente capturando su propia calificación -- ese docente
-- no tiene ni debe tener permiso para editar Expediente_Academico en
-- general. Esta función toca EXCLUSIVAMENTE promedio_actual (columna
-- derivada, calculada en Python por ADR-005, nunca escrita a mano por
-- ningún rol vía API) -- no abre una vía para modificar
-- situacion_academica, escuela_procedencia ni ningún otro campo.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_actualizar_promedio_actual(p_id_alumno INT, p_promedio NUMERIC)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
    UPDATE expediente_academico
    SET promedio_actual = p_promedio
    WHERE id_alumno = p_id_alumno;
$$;

REVOKE ALL ON FUNCTION fn_actualizar_promedio_actual(INT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_actualizar_promedio_actual(INT, NUMERIC) TO sige_app;