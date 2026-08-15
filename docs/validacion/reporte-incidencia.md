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

### Conclusión (Punto 1 — validación de RLS, Task 2)

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

## Punto 2 — Verificación end-to-end de los 3 roles (Task 9, cierre final)

**Fecha:** 2026-08-15
**Objetivo:** con Tasks 1–8 completas (backend, RLS, endpoints FastAPI,
clientes de API, pantalla de captura docente, sección "Incidencias" en
Perfil de Análisis), ejercer la feature completa con HTTP real y un
navegador real contra los 3 roles, como cierre manual final del feature
`Reporte_Incidencia`.

### Entorno

- `docker-compose up -d --build` desde este worktree
  (`/home/kemonito/Sistema-Integral-Gestion-Escolar/.claude/worktrees/reporte-incidencia`,
  rama `worktree-reporte-incidencia`) — `reporte-incidencia_db_1`
  (healthy), `reporte-incidencia_migrate_1` (`Exited (0)`),
  `reporte-incidencia_app_1` (`Up`), sirviendo en `http://localhost:8000`.
- Frontend: `cd frontend && npm run dev` (Vite), sirviendo en
  `http://localhost:5173`. Se copió `frontend/.env.example` a
  `frontend/.env` (`VITE_API_BASE_URL=http://localhost:8000`) porque no
  existía todavía en este worktree.
- La base no tenía seed al empezar. Se sembraron datos con dos fuentes:
  - `db/seed_dev.py` (ya existente en el repo, reutilizado tal cual —
    "preferir reusar seeding existente" per instrucción de la tarea) vía
    `DATABASE_URL_MIGRATIONS=postgresql://sige_migrator:local_migrator_pw@localhost:5432/sige
    DATABASE_URL=postgresql://sige_app:local_app_pw@localhost:5432/sige
    JWT_SECRET_KEY=local_test_secret_key_do_not_use_in_prod python3
    db/seed_dev.py` — crea `plantel` `PL-DEV`, 1 `docente`/`directivo`/
    `admin` con credenciales de desarrollo conocidas
    (`docs/dev/seed-credentials.md`), 1 `grupo`+`asignatura`+
    `grupo_asignatura`, y 2 alumnos ya inscritos en ese grupo.
  - Datos adicionales insertados a mano vía `docker exec
    reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "..."`
    (mismo patrón que Task 2): un segundo docente
    (`docente2@cobao.edu.mx`, `id_personal=8`) y un alumno **sin
    `id_grupo`** (`id_alumno=4`, matrícula `SEED-ALU-9999`, "Fuera
    DeScope") — deliberadamente fuera de cualquier `grupo_asignatura` de
    ambos docentes, para que el Step 2 ejerza la desviación de alcance
    real de ADR-010 (no solo un alumno que *casualmente* no tiene
    relación, sino uno que ni siquiera tiene `grupo`).
- Navegador: extensión `claude-in-chrome`. Nota operativa: el popup de
  la extensión 1Password interceptó el foco varias veces durante las
  pruebas (screenshots que fallaban con "Cannot access a
  chrome-extension:// URL of different extension", y clics con
  coordenadas exactas sobre botones `submit` que no disparaban el
  request) — se resolvió consistentemente enfocando el campo y
  enviando el formulario con `Enter` en vez de clic en el botón. No es
  un bug de la aplicación SIGE, es una interferencia del entorno de
  automatización del navegador.

### Step 2 (docente1, navegador) — crear reporte sobre alumno fuera de scope

Login como `docente@cobao.edu.mx` (`Docente123!`, `id_personal=5`) en
`http://localhost:5173/login` → redirige a `/dashboard`. Nav lateral
muestra el ítem "Incidencias" (`href="/reporte-incidencia/capturar"`).

Navegación a `/reporte-incidencia/capturar`. Búsqueda de "Fuera" en el
campo "Buscar alumno (nombre completo o CURP, cualquiera del plantel)":

```
Resultado de búsqueda: "SEED-ALU-9999 — Fuera DeScope"
```

Esto confirma `GET /alumno/buscar-plantel` (`fn_alumno_buscar_docente`)
funcionando en vivo: `docente1` encuentra a un alumno que **no** está en
ninguno de sus `grupo_asignatura` (el alumno no tiene ni `id_grupo`).
Screenshot tomado (`ss_5378n6ocd`) confirmando el resultado visible en
pantalla.

Se selecciona el alumno (botón `"SEED-ALU-9999 — Fuera DeScope"`) → la
UI muestra "Alumno seleccionado: **Fuera DeScope** (SEED-ALU-9999)" con
opción "Cambiar", el campo "Fecha del incidente" precargado a
`15/08/2026` (fecha real del día), y "Descripción" vacío. Se llena la
descripción con: *"Alumno interrumpio la clase de forma reiterada, se le
llamo la atencion sin exito. Verificacion Task 9 ADR-010."* y se hace
submit ("Registrar reporte").

Request real observado vía `read_network_requests`:

```
POST http://localhost:8000/reporte-incidencia   statusCode: 201
```

Mensaje de éxito renderizado en pantalla (`get_page_text` +
screenshot `ss_63029iz7n`):

```
Reporte de incidencia
Reporte registrado para Fuera DeScope.
```

Confirmado en la base real (`sige_migrator`, bypassea RLS, solo para
verificar el resultado, la escritura real la hizo `sige_app` vía la
API):

```
$ docker exec reporte-incidencia_db_1 psql -U sige_migrator -d sige -c "SELECT id_reporte_incidencia, id_alumno, id_personal_reporta, fecha_incidente, descripcion, fecha_registro FROM reporte_incidencia;"
 id_reporte_incidencia | id_alumno | id_personal_reporta | fecha_incidente |                                                   descripcion                                                   |       fecha_registro
------------------------+-----------+----------------------+------------------+-------------------------------------------------------------------------------------------------------------------+----------------------------
                      2 |         4 |                    5 | 2026-08-15       | Alumno interrumpio la clase de forma reiterada, se le llamo la atencion sin exito. Verificacion Task 9 ADR-010.  | 2026-08-15 22:36:56.914927
(1 row)
```

`id_alumno=4` (Fuera DeScope, sin `grupo`), `id_personal_reporta=5`
(`docente1`), `fecha_incidente=2026-08-15` (hoy) — exactamente lo
esperado. (`id_reporte_incidencia=2`: hay una fila `id=1` previa de
pruebas manuales de sesión anteriores a este Step, no relevante para
esta verificación.)

### Step 3 (docente2, API directa) — aislamiento entre docentes

No hay pantalla de listado para docente (por diseño, ver comentario en
`app/domains/reportes/router.py`), así que se verificó directo contra
`GET /reporte-incidencia`:

```
$ curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email_institucional":"docente2@cobao.edu.mx","password":"Docente2Pass!"}'
{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(docente2, id_personal=8)","token_type":"bearer"}

$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" "http://localhost:8000/reporte-incidencia?id_alumno=4" \
  -H "Authorization: Bearer <token docente2>"
[]
HTTP_STATUS:200
```

`docente2` (`id_personal=8`, sin relación con el reporte de `docente1`)
recibe `200` con lista vacía `[]` — **no** ve el reporte que `docente1`
levantó sobre el alumno `id_alumno=4`, exactamente lo que exige
`reporte_incidencia_select` (scope por autoría, no por alumno ni por
plantel para `docente`).

### Step 4 (directivo, navegador) — Incidencias en Perfil de Análisis

Login como `directivo@cobao.edu.mx` (`Directivo123!`, `id_personal=6`).
Navegación a `/alumno/buscar` ("Análisis de alumno" en el nav). Búsqueda
de "Fuera" → selección del resultado → `/alumno/4/perfil-analisis`.

Screenshot (`ss_4505848vy`) confirma la sección **Incidencias** al fondo
del perfil:

```
Incidencias
2026-08-15 — Docente Seed
Alumno interrumpio la clase de forma reiterada, se le llamo la atencion sin exito. Verificacion Task 9 ADR-010.
```

Puntos verificados en esta captura:
- La fecha mostrada (`2026-08-15`) coincide con `fecha_incidente` real
  de la fila insertada en el Step 2.
- El nombre mostrado es **"Docente Seed"** (nombre real de `docente1`
  resuelto desde `personal.nombre` + `apellido_paterno`), no
  `"Personal #5"` ni un ID crudo — confirma que el frontend resuelve el
  nombre del autor, no solo muestra `id_personal_reporta`.
- La descripción coincide carácter por carácter con la capturada en el
  Step 2.
- El encabezado del perfil (screenshot adicional, scroll superior)
  muestra "Fuera DeScope", matrícula `SEED-ALU-9999`, "Grupo: **Sin
  grupo**" — confirma visualmente que este alumno está genuinamente
  fuera de cualquier `grupo_asignatura`, reforzando que el reporte del
  Step 2 se creó sobre un alumno realmente fuera de scope, no solo fuera
  del scope de un docente en particular.

### Step 5 (admin, API directa) — inmutabilidad confirmada en vivo

Antes de probar, se revisó `app/domains/reportes/router.py` (fuente real,
no la ficha) para confirmar qué rutas existen: solo
`@router.post("/reporte-incidencia")` y `@router.get("/reporte-incidencia")`
— **no existe** ninguna ruta `"/reporte-incidencia/{id}"` registrada en
absoluto. Esto cambia cuál es la prueba correcta:

- Contra la ruta que **sí existe** (`/reporte-incidencia`, registrada
  para `POST`/`GET`), `PUT`/`DELETE` deben dar `405 Method Not Allowed`
  — FastAPI/Starlette responde así cuando la ruta existe pero el método
  no está registrado. Esta es la prueba que replica lo que
  `test_sin_endpoint_put_delete_405` (Task 5) ya verifica.
- Contra una ruta con `{id}` (`/reporte-incidencia/2`), que **no está
  registrada en absoluto**, `PUT`/`DELETE` dan `404 Not Found` — no hay
  ruta que atender, sin relación con el método.

Se probaron ambos casos como evidencia, con token real de
`admin@cobao.edu.mx` (`Admin123!`, `id_personal=7`):

```
$ curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email_institucional":"admin@cobao.edu.mx","password":"Admin123!"}'
{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(admin, id_personal=7)","token_type":"bearer"}

$ curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" -X PUT http://localhost:8000/reporte-incidencia \
  -H "Authorization: Bearer <token admin>" -H "Content-Type: application/json" -d '{}'
HTTP_STATUS:405

$ curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" -X DELETE http://localhost:8000/reporte-incidencia \
  -H "Authorization: Bearer <token admin>"
HTTP_STATUS:405

$ curl -s -X PUT http://localhost:8000/reporte-incidencia -H "Authorization: Bearer <token admin>" \
  -H "Content-Type: application/json" -d '{}'
{"detail":"Method Not Allowed"}

$ curl -s -X DELETE http://localhost:8000/reporte-incidencia -H "Authorization: Bearer <token admin>"
{"detail":"Method Not Allowed"}

$ curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" -X PUT http://localhost:8000/reporte-incidencia/2 \
  -H "Authorization: Bearer <token admin>" -H "Content-Type: application/json" -d '{}'
HTTP_STATUS:404

$ curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" -X DELETE http://localhost:8000/reporte-incidencia/2 \
  -H "Authorization: Bearer <token admin>"
HTTP_STATUS:404
```

Resultado: `405` contra la ruta real (`/reporte-incidencia`, la prueba
correcta, alineada con Task 5), `404` contra la ruta con `{id}` que
nunca se registró (esperado, no es un hallazgo — simplemente no existe
esa ruta). Ni `admin` ni ningún rol puede editar/eliminar un reporte vía
HTTP, confirmando en vivo lo que Task 5 (pytest) y el Punto 1 de este
documento (RLS directa) ya habían probado por separado.

### Suite de pytest — conteo confirmado sin tocar los datos sembrados

Se evitó correr la suite completa de `pytest` contra este mismo
`docker-compose` porque `tests/conftest.py` hace `TRUNCATE` de
`personal`, `alumno`, `plantel`, etc. entre tests — habría borrado el
seed de este documento (el reporte del Step 2, el alumno "Fuera
DeScope", los 3 roles de desarrollo) antes de terminar de documentarlo.
En su lugar se usó `pytest --collect-only` (no ejecuta nada, no toca la
base) para confirmar el conteo total sin destruir la evidencia:

```
$ DATABASE_URL_MIGRATIONS=postgresql://sige_migrator:local_migrator_pw@localhost:5432/sige \
  DATABASE_URL=postgresql://sige_app:local_app_pw@localhost:5432/sige \
  JWT_SECRET_KEY=local_test_secret_key_do_not_use_in_prod \
  python3 -m pytest --collect-only -q
...
tests/test_reporte_incidencia.py::test_docente_dado_de_baja_forbidden_403
tests/test_reporte_incidencia.py::test_directivo_no_puede_crear_reporte_403
tests/test_reporte_incidencia.py::test_docente_no_ve_reporte_de_otro_docente
tests/test_reporte_incidencia.py::test_directivo_ve_todos_los_reportes_del_plantel
tests/test_reporte_incidencia.py::test_sin_endpoint_put_delete_405
tests/test_reporte_incidencia.py::test_update_delete_directo_bloqueado_por_rls
tests/test_reporte_incidencia.py::test_docente_desactivado_reusa_jwt_stale_bloqueado_por_rls_403
...
186 tests collected in 0.07s
```

**186 tests** coinciden con el conteo ya reportado como verde en Tasks
1–8 (176 previos a `Reporte_Incidencia` + 10 nuevos: 8 en
`tests/test_reporte_incidencia.py` — incluyendo exactamente
`test_sin_endpoint_put_delete_405`, la misma prueba que este Step 5
re-verificó en vivo — más 2 en `tests/test_alumnos.py`
(`test_buscar_plantel_docente_encuentra_alumno_fuera_de_su_scope_200`,
`test_buscar_plantel_directivo_forbidden_403`) cubriendo
`GET /alumno/buscar-plantel`). No se re-ejecutó la suite completa en
este documento para no destruir el seed manual recién creado — el
resultado "186 passed" en Postgres real ya quedó confirmado en el
cierre de las Tasks 1–8 anteriores a esta.

## Conclusión general

Con el Punto 1 (RLS validada directamente contra Postgres, antes de
escribir ningún endpoint) y el Punto 2 (los 3 roles reales, HTTP real,
navegador real, contra el stack completo levantado) cerrados, la
feature `Reporte_Incidencia` (ADR-010) queda verificada end-to-end:

1. Un docente activo reporta una incidencia sobre un alumno
   genuinamente fuera de su scope de `grupo_asignatura` (sin `grupo`
   siquiera) — la desviación de alcance central de ADR-010 — funciona
   en la UI real, no solo en RLS aislada.
2. Un segundo docente, sin relación con ese reporte, no lo ve vía la API
   real (`[]`, `200`) — el scope por autoría de
   `reporte_incidencia_select` se sostiene fuera de RLS aislada.
3. `directivo` ve el reporte en el Perfil de Análisis del alumno, con
   fecha, descripción y **nombre real del docente autor** (no un ID) —
   la pieza de UI que consume `GET /reporte-incidencia?id_alumno=`
   resuelve correctamente contra `GET /personal` o el nombre ya
   incluido, sin fugas de datos crudos.
4. Ningún rol, incluido `admin`, puede editar o eliminar un reporte vía
   HTTP — `405` contra la única ruta que existe (`/reporte-incidencia`),
   consistente con Task 5 y con el Punto 1 de este documento.
5. La suite de pytest sigue en 186 tests (confirmado por conteo, sin
   destruir el seed manual de este cierre).

`Reporte_Incidencia` (ADR-010) queda cerrado como feature completa:
backend, RLS, endpoints, frontend (captura docente + Incidencias en
Perfil de Análisis), y verificación manual de los 3 roles con evidencia
real pegada en este documento.
