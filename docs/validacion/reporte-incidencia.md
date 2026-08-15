# Log de validación — `reporte_incidencia` (ADR-010)

**Fecha:** 2026-08-15
**Objetivo:** repetir el patrón de validación de ADR-007/ADR-008 — confirmar,
conectando con el rol real de runtime (`sige_app`, nunca `sige_migrator`),
que las políticas RLS de `reporte_incidencia` (Task 1) se comportan
exactamente como diseña ADR-010, **antes** de escribir ningún endpoint de
FastAPI. Esto le da a los implementadores de Task 3/4 una base validada en
vez de tener que re-derivar el comportamiento de RLS por su cuenta.

## Entorno

- Stack de `docker-compose` de Task 1 ya levantado y migrado
  (`reporte-incidencia_db_1`, `reporte-incidencia_migrate_1` con
  `ExitCode 0`, `reporte-incidencia_app_1`), sin volumen limpio — no se hizo
  `down -v` para esta validación.
- Todos los comandos `psql` se ejecutaron vía `docker exec` contra el
  contenedor de la base (`docker exec reporte-incidencia_db_1 psql -U
  <rol> -d sige -c "..."`), no contra un cliente `psql` del host — es como
  se conectó exitosamente en Task 1.
- Confirmado antes de sembrar datos: la tabla `reporte_incidencia`, sus 2
  políticas RLS (`reporte_incidencia_insert`, `reporte_incidencia_select`)
  y la función `fn_alumno_buscar_docente` ya existen en el esquema
  aplicado (Task 1):

```
$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "\d reporte_incidencia"
                                                       Table "public.reporte_incidencia"
        Column         |            Type             | Collation | Nullable |                              Default
-----------------------+-----------------------------+-----------+----------+---------------------------------------------------------------------
 id_reporte_incidencia | integer                     |           | not null | nextval('reporte_incidencia_id_reporte_incidencia_seq'::regclass)
 id_alumno             | integer                     |           | not null |
 id_personal_reporta   | integer                     |           | not null |
 fecha_incidente       | date                        |           | not null |
 descripcion           | text                        |           | not null |
 fecha_registro        | timestamp without time zone |           | not null | now()
Policies:
    POLICY "reporte_incidencia_insert" FOR INSERT
      WITH CHECK (((app_current_rol() = 'docente'::text) AND (id_personal_reporta = app_current_personal_id()) AND (EXISTS ( SELECT 1
   FROM personal
  WHERE ((personal.id_personal = app_current_personal_id()) AND ((personal.estatus)::text = 'activo'::text))))))
    POLICY "reporte_incidencia_select" FOR SELECT
      USING (((app_current_rol() = ANY (ARRAY['directivo'::text, 'admin'::text])) OR (id_personal_reporta = app_current_personal_id())))

$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "\df fn_alumno_buscar_docente"
 Schema |           Name           |                                                                    Result data type
 ...    | Argument data types     | Type
--------+--------------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------------+----------------------------+------
 public | fn_alumno_buscar_docente | TABLE(id_alumno integer, matricula character varying, nombre character varying, apellido_paterno character varying, apellido_materno character varying) | p_search character varying | func
(1 row)
```

## Ajuste sobre el guion original (importante para reproducir)

El guion de la ficha (`task-2-brief.md`, Step 1) asume que `plantel` solo
necesita `nombre_plantel`. El esquema real (`db/ddl_mvp.sql`) exige también
`clave_plantel`, `municipio` y `estado` (`NOT NULL`, sin default). El primer
intento del `INSERT INTO plantel (nombre_plantel) VALUES (...)` falló con
`null value in column "clave_plantel"` y se corrigió a `INSERT INTO plantel
(clave_plantel, nombre_plantel, municipio, estado) VALUES ('PL-RLS',
'Plantel RLS test', 'Oaxaca de Juarez', 'Oaxaca')`.

Ese primer intento fallido (y un segundo intento que falló por FK porque el
`plantel` insertado en la misma sentencia se revirtió pero la secuencia sí
avanzó — comportamiento normal de Postgres, las secuencias no son
transaccionales) hicieron que los IDs reales quedaran desplazados respecto
a los que asume el guion (`id_personal=1..4`, `id_alumno=1` empezando de
cero). El seed que finalmente quedó insertado, y los IDs reales usados en
cada paso de abajo, son:

| Entidad | Esperado por el guion | Real (usado en los comandos) |
|---|---|---|
| `plantel` (Plantel RLS test) | `id_plantel=1` | `id_plantel=3` |
| `docente1` (activo) | `id_personal=1` | `id_personal=5` |
| `docente2` (activo) | `id_personal=2` | `id_personal=6` |
| `docente3` (baja) | `id_personal=3` | `id_personal=7` |
| `directivo1` (activo) | `id_personal=4` | `id_personal=8` |
| `alumno` (Alumno Uno) | `id_alumno=1` | `id_alumno=1` (sin cambio) |

Los IDs son arbitrarios para efectos de la prueba — lo que importa es la
relación entre ellos (docente activo vs. baja, propio vs. ajeno), que se
preservó exactamente como la diseña el guion. Todos los comandos de abajo
usan los IDs reales de la tabla de arriba.

## Seed (Step 1, como `sige_migrator`, bypassea RLS)

```
$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "
INSERT INTO plantel (clave_plantel, nombre_plantel, municipio, estado) VALUES ('PL-RLS', 'Plantel RLS test', 'Oaxaca de Juarez', 'Oaxaca') RETURNING id_plantel;
"
 id_plantel
------------
          3
(1 row)
INSERT 0 1

$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "
INSERT INTO personal (id_plantel, curp, nombre, apellido_paterno, email_institucional, rol, password_hash, estatus)
VALUES
  (3, 'CURPDOC0000000001', 'Docente', 'Uno', 'docente1@rls.test', 'docente', 'x', 'activo'),
  (3, 'CURPDOC0000000002', 'Docente', 'Dos', 'docente2@rls.test', 'docente', 'x', 'activo'),
  (3, 'CURPDOC0000000003', 'Docente', 'Baja', 'docente3@rls.test', 'docente', 'x', 'baja'),
  (3, 'CURPDIR0000000001', 'Directivo', 'Uno', 'directivo1@rls.test', 'directivo', 'x', 'activo')
RETURNING id_personal, curp, rol, estatus;
INSERT INTO alumno (id_plantel, matricula, curp, nombre, apellido_paterno, fecha_nacimiento, fecha_inscripcion)
VALUES (3, 'MAT-0001', 'CURPALUM000000001', 'Alumno', 'Uno', '2008-01-01', '2026-01-01')
RETURNING id_alumno;
"
 id_personal |        curp        |    rol    | estatus
-------------+--------------------+-----------+---------
           5 | CURPDOC0000000001  | docente   | activo
           6 | CURPDOC0000000002  | docente   | activo
           7 | CURPDOC0000000003  | docente   | baja
           8 | CURPDIR0000000001  | directivo | activo
(4 rows)
INSERT 0 4

 id_alumno
-----------
         1
(1 row)
INSERT 0 1
```

## Punto 1 — RLS validada con `sige_app` antes de FastAPI

### Step 2 — INSERT de un docente activo, alumno fuera de cualquier relación (la desviación central de alcance de ADR-010)

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '5', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 5, '2026-08-14', 'Prueba RLS') RETURNING id_reporte_incidencia;
"
 set_config
------------
 docente
(1 row)

 set_config
------------
 5
(1 row)

 id_reporte_incidencia
-----------------------
                     1
(1 row)

INSERT 0 1
```

Resultado: 1 fila insertada, `INSERT 0 1`, exactamente lo esperado.
Confirma en la base real el comportamiento que ADR-010 justifica:
`docente1` (`id_personal=5`) puede reportar una incidencia de un alumno con
el que no tiene relación previa vía `grupo_asignatura`.

### Step 3 — Anti-suplantación: un docente no puede insertar con el `id_personal_reporta` de otro

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '5', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 6, '2026-08-14', 'Suplantacion') RETURNING id_reporte_incidencia;
"
 set_config
------------
 docente
(1 row)

 set_config
------------
 5
(1 row)

ERROR:  new row violates row-level security policy for table "reporte_incidencia"
```

Resultado: `ERROR: new row violates row-level security policy for table
"reporte_incidencia"`, exactamente lo esperado. `docente1` (sesión
`id_personal=5`) intentando insertar con `id_personal_reporta=6` (id de
`docente2`) es rechazado por el `WITH CHECK` de `reporte_incidencia_insert`.

### Step 4 — Un docente dado de baja no puede insertar aunque su claim de sesión diga "docente"

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '7', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 7, '2026-08-14', 'Docente dado de baja') RETURNING id_reporte_incidencia;
"
 set_config
------------
 docente
(1 row)

 set_config
------------
 7
(1 row)

ERROR:  new row violates row-level security policy for table "reporte_incidencia"
```

Resultado: `ERROR: new row violates row-level security policy`,
exactamente lo esperado. `docente3` (`id_personal=7`, `estatus='baja'`)
es rechazado — este es el caso que se le escaparía a `require_roles("docente")`
solo (el claim del JWT seguiría diciendo `docente`), atrapado únicamente
por la cláusula `EXISTS` contra `personal.estatus` dentro del `WITH CHECK`.

### Step 5 — Directivo no puede insertar (matriz: solo docente crea)

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'directivo', false);
SELECT set_config('app.current_personal_id', '8', false);
INSERT INTO reporte_incidencia (id_alumno, id_personal_reporta, fecha_incidente, descripcion)
VALUES (1, 8, '2026-08-14', 'Directivo intentando crear') RETURNING id_reporte_incidencia;
"
 set_config
------------
 directivo
(1 row)

 set_config
------------
 8
(1 row)

ERROR:  new row violates row-level security policy for table "reporte_incidencia"
```

Resultado: `ERROR: new row violates row-level security policy`,
exactamente lo esperado. `directivo1` (`id_personal=8`) no puede insertar
— el `WITH CHECK` exige `app_current_rol() = 'docente'` explícitamente.

### Step 6 — Alcance de SELECT: docente 2 no ve el reporte de docente 1, directivo ve todo

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '6', false);
SELECT count(*) FROM reporte_incidencia;
"
 set_config
------------
 docente
(1 row)

 set_config
------------
 6
(1 row)

 count
-------
     0
(1 row)
```

Resultado: `0`, exactamente lo esperado (solo existe la fila de
`docente1`, del Step 2; `docente2`, id_personal=6, no la ve).

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'directivo', false);
SELECT set_config('app.current_personal_id', '8', false);
SELECT count(*) FROM reporte_incidencia;
"
 set_config
------------
 directivo
(1 row)

 set_config
------------
 8
(1 row)

 count
-------
     1
(1 row)
```

Resultado: `1`, exactamente lo esperado. `directivo1` ve la fila
completa vía el `OR app_current_rol() = ANY(ARRAY['directivo','admin'])`
de `reporte_incidencia_select`.

### Step 7 — UPDATE/DELETE denegado para todo rol, incluido admin (defensa en profundidad más allá de "no hay endpoint")

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'admin', false);
SELECT set_config('app.current_personal_id', '8', false);
UPDATE reporte_incidencia SET descripcion = 'editado' WHERE id_reporte_incidencia = 1;
DELETE FROM reporte_incidencia WHERE id_reporte_incidencia = 1;
"
 set_config
------------
 admin
(1 row)

 set_config
------------
 8
(1 row)

UPDATE 0
DELETE 0
```

Resultado: `UPDATE 0` y `DELETE 0`, exactamente lo esperado. Postgres
deniega ambos en silencio (0 filas bajo RLS, no error) porque no existe
ninguna política de `UPDATE`/`DELETE` para esta tabla — mismo
comportamiento ya documentado para `auditoria_calificacion` en
`docs/validacion/fase-05-calificaciones.md`. Confirmado incluso para
`admin`, que no es superusuario/owner y por tanto no bypassea RLS.

### Step 8 — `fn_alumno_buscar_docente` devuelve el alumno para un docente, y 0 filas para directivo

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'docente', false);
SELECT set_config('app.current_personal_id', '6', false);
SELECT * FROM fn_alumno_buscar_docente('Alumno');
"
 set_config
------------
 docente
(1 row)

 set_config
------------
 6
(1 row)

 id_alumno | matricula | nombre | apellido_paterno | apellido_materno
-----------+-----------+--------+------------------+------------------
         1 | MAT-0001  | Alumno | Uno              |
(1 row)
```

Resultado: 1 fila (`id_alumno=1`), exactamente lo esperado.
`docente2` (`id_personal=6`) — sin relación alguna con este alumno vía
`grupo_asignatura` — puede encontrarlo de todos modos vía esta función, a
diferencia de `alumno_select`. Esto es exactamente lo que
`fn_alumno_buscar_docente` (SECURITY DEFINER) existe para permitir.

```
$ docker exec reporte-incidencia_db_1 psql -U sige_app -d sige -c "
SELECT set_config('app.current_rol', 'directivo', false);
SELECT set_config('app.current_personal_id', '8', false);
SELECT * FROM fn_alumno_buscar_docente('Alumno');
"
 set_config
------------
 directivo
(1 row)

 set_config
------------
 8
(1 row)

 id_alumno | matricula | nombre | apellido_paterno | apellido_materno
-----------+-----------+--------+------------------+------------------
(0 rows)
```

Resultado: 0 filas, exactamente lo esperado. El filtro interno
`WHERE app_current_rol() = 'docente'` de la función excluye a cualquier
llamador que no sea docente, incluido `directivo`.

### Step 9 — Limpieza del seed manual

```
$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "TRUNCATE reporte_incidencia, personal, alumno, plantel RESTART IDENTITY CASCADE;"
NOTICE:  truncate cascades to table "grupo"
NOTICE:  truncate cascades to table "grupo_asignatura"
NOTICE:  truncate cascades to table "expediente_academico"
NOTICE:  truncate cascades to table "calificacion"
NOTICE:  truncate cascades to table "auditoria_calificacion"
NOTICE:  truncate cascades to table "asistencia"
TRUNCATE TABLE
```

Verificado vacío después de la limpieza:

```
$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "SELECT (SELECT count(*) FROM plantel) plantel, (SELECT count(*) FROM personal) personal, (SELECT count(*) FROM alumno) alumno, (SELECT count(*) FROM reporte_incidencia) reporte;"
 plantel | personal | alumno | reporte
---------+----------+--------+---------
       0 |        0 |      0 |       0
(1 row)
```

Los `NOTICE` de cascada son esperados (`grupo`, `grupo_asignatura`,
`expediente_academico`, `calificacion`, `auditoria_calificacion`,
`asistencia` referencian `plantel`/`personal`/`alumno` por FK) y no
indican pérdida de datos reales — todas esas tablas ya estaban vacías
antes de la limpieza (el volumen de Task 1 no tenía datos previos, solo
el seed manual de este documento).

## Conclusión

Las 7 verificaciones de RLS/función pedidas por la ficha (Steps 2–8) se
comportaron exactamente como diseña ADR-010, contra Postgres real con el
rol de runtime real (`sige_app`), sin ningún código de FastAPI de por
medio:

1. Docente activo inserta un reporte de un alumno fuera de su scope de
   `grupo_asignatura` — funciona (la desviación de alcance central de
   ADR-010).
2. Anti-suplantación (`id_personal_reporta` ajeno) — bloqueado.
3. Docente dado de baja con claim de sesión válido — bloqueado (única
   defensa: el `EXISTS` contra `personal.estatus`, no la capa HTTP).
4. Directivo intentando insertar — bloqueado (solo docente crea).
5. SELECT: docente ve solo lo propio, directivo ve todo.
6. UPDATE/DELETE: denegado en silencio para cualquier rol, incluido
   `admin` — no existe política para esos comandos, defensa en
   profundidad más allá de "no hay endpoint".
7. `fn_alumno_buscar_docente`: docente sin relación previa con el alumno
   igual lo encuentra (el propósito de la función); directivo obtiene 0
   filas (filtro interno por rol).

Con esta base validada, Task 3/4 pueden construir los endpoints de FastAPI
confiando en que el comportamiento de RLS ya está probado, no asumido.
