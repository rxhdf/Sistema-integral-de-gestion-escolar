# Log de validación — Gestión de Cuentas (backend): reseteo de contraseña, bloqueo temporal, log de accesos (ADR-011)

**Fecha:** 2026-08-16
**Alcance:** solo backend, siguiendo el diseño cerrado en
`docs/data_dictionary/gestion-cuentas.md`. Frontend queda para un paso
posterior — no se tocó nada de `frontend/` en este trabajo.

## Migraciones aplicadas

Dos migraciones nuevas, encadenadas desde el head anterior (`b7c2e4f19a03`,
`Reporte_Incidencia`):

```
$ docker-compose run --rm migrate alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade b7c2e4f19a03 -> 6ccb09ee0faa,
      personal.estatus CHECK amplia a 'bloqueado' (Gestion de Cuentas, Pieza 2)
INFO  [alembic.runtime.migration] Running upgrade 6ccb09ee0faa -> 23e24f6cd81d,
      log_acceso table + RLS, fn_registrar_intento_login (Gestion de Cuentas, Pieza 3, ADR-011)
```

- `6ccb09ee0faa`: agrega `CHECK (estatus IN ('activo', 'baja', 'bloqueado'))`
  sobre `personal.estatus`. **Hallazgo respecto al diseño:** el diccionario
  de datos describe esto como "ampliar el CHECK existente", pero
  `personal.estatus` no tenía ningún CHECK (confirmado en
  `db/ddl_mvp.sql` antes de este cambio — era `VARCHAR(20) NOT NULL
  DEFAULT 'activo'` sin restricción de valores). Esta migración lo crea
  de una vez con los 3 valores vigentes, no en dos pasos.
- `23e24f6cd81d`: crea `log_acceso` (con RLS) y `fn_registrar_intento_login`
  (`SECURITY DEFINER`, ver ADR-011 para el porqué de una función separada
  de `fn_login_lookup`).

## Punto 1 — RLS y CHECK validados con `sige_app` directo, antes de tocar FastAPI

Todos los comandos corrieron vía `docker-compose exec` contra el
contenedor real de Postgres (`db`), con el rol de runtime real
(`sige_app`, nunca `sige_migrator`) para las pruebas de RLS.

### 1a. `fn_login_lookup` (ADR-007) ya rechaza `estatus='bloqueado'` — verificado, no asumido

```
$ docker-compose exec db psql -U sige_migrator -d sige -c \
  "UPDATE personal SET estatus = 'bloqueado' WHERE email_institucional = 'docente@cobao.edu.mx';"
UPDATE 1

$ docker-compose exec -e PGPASSWORD=local_app_pw db psql -U sige_app -d sige
SELECT set_config('app.current_rol', 'admin', false);
SELECT set_config('app.current_personal_id', '7', false);
SELECT * FROM fn_login_lookup('docente@cobao.edu.mx');
 id_personal | rol | password_hash | estatus
-------------+-----+---------------+---------
(0 rows)
```

`0 rows` — exactamente lo esperado. `fn_login_lookup` filtra
`estatus = 'activo'` dentro de su propio `WHERE` (sin cambios a esa
función, ADR-007 se mantiene intacto); ampliar el `CHECK` de `estatus`
fue suficiente para que `'bloqueado'` quede rechazado en el login sin
tocar esa función.

### 1b. `fn_registrar_intento_login` calcula `motivo_fallo` correctamente para los 4 casos

```
SELECT fn_registrar_intento_login('admin@cobao.edu.mx', true);   -- éxito
SELECT fn_registrar_intento_login('admin@cobao.edu.mx', false);  -- password incorrecta, cuenta activa
SELECT fn_registrar_intento_login('noexiste@sige.test', false);  -- email inexistente
SELECT fn_registrar_intento_login('docente.baja@sige.test', false); -- cuenta de baja (via seed pytest)
SELECT fn_registrar_intento_login('docente@cobao.edu.mx', false);   -- cuenta bloqueada (del paso 1a)

SELECT id_log, email_intentado, id_personal, exitoso, motivo_fallo FROM log_acceso ORDER BY id_log;
 id_log |    email_intentado     | id_personal | exitoso |      motivo_fallo
--------+------------------------+-------------+---------+------------------------
      1 | admin@cobao.edu.mx     |           7 | t       |
      2 | admin@cobao.edu.mx     |           7 | f       | credenciales_invalidas
      3 | noexiste@sige.test     |             | f       | credenciales_invalidas
      4 | docente.baja@sige.test |           2 | f       | cuenta_baja
      6 | docente@cobao.edu.mx   |           5 | f       | cuenta_bloqueada
```

Los 5 casos calcularon el `motivo_fallo` esperado:
`exitoso=true` → `NULL`; password incorrecta sobre cuenta activa →
`credenciales_invalidas`; email inexistente → `credenciales_invalidas`
con `id_personal=NULL` (no rompe integridad referencial); cuenta `baja`
→ `cuenta_baja`; cuenta `bloqueada` → `cuenta_bloqueada`. La contraseña
intentada nunca se pasó a la función — solo el email y un booleano ya
calculado.

### 1c. `log_acceso_select`: solo `admin` lee

```
-- directivo (id_personal=6): 0 filas
SELECT count(*) FROM log_acceso;  →  0

-- docente (id_personal=5): 0 filas
SELECT count(*) FROM log_acceso;  →  0

-- admin (id_personal=7): ve las 5 filas sembradas
SELECT count(*) FROM log_acceso;  →  5
```

Resultado exacto: `directivo` y `docente` obtienen `0` filas (RLS
deniega, no un error) mientras `admin` ve las filas reales — confirma
`log_acceso_select` (`USING (app_current_rol() = 'admin')`) tal como se
diseñó.

### 1d. Defensa en profundidad: ni siquiera `admin` puede escribir directo a `log_acceso`

```
-- UPDATE/DELETE directo, sesión admin
UPDATE log_acceso SET motivo_fallo = 'hackeado' WHERE id_log = 1;  →  UPDATE 0
DELETE FROM log_acceso WHERE id_log = 1;                           →  DELETE 0

-- INSERT directo, sesión admin
INSERT INTO log_acceso (email_intentado, exitoso) VALUES ('direct@sige.test', true);
ERROR:  new row violates row-level security policy for table "log_acceso"
```

`UPDATE 0` / `DELETE 0` (denegado en silencio, sin política para esos
comandos — mismo patrón que `auditoria_calificacion`/
`reporte_incidencia`) y el `INSERT` directo es rechazado con error de
RLS explícito, aunque `sige_app` sí tiene el `GRANT` de tabla vía
`ALTER DEFAULT PRIVILEGES` (ADR-006) — la tabla no tiene ninguna
política de `INSERT`, así que ese `GRANT` de tabla no basta. El único
camino de escritura real es `fn_registrar_intento_login`
(`SECURITY DEFINER`, corre como `sige_migrator`, bypassea RLS como
owner).

### 1e. El `CHECK` nuevo rechaza valores fuera de los 3 vigentes

```
$ docker-compose exec db psql -U sige_migrator -d sige -c \
  "UPDATE personal SET estatus = 'inexistente' WHERE email_institucional = 'docente@cobao.edu.mx';"
ERROR:  new row for relation "personal" violates check constraint "chk_personal_estatus"
```

Confirmado. Se restauró `docente@cobao.edu.mx` a `estatus='activo'`
inmediatamente después de estas pruebas manuales (limpieza del dato de
desarrollo).

## Punto 2 — Suite de pytest (Postgres real, `sige_app` en runtime)

Se corrió tres veces por separado para aislar variables: la suite
existente sola (confirmar que nada se rompió), los tests nuevos solos, y
la suite completa junta.

```
$ pytest -q                              # 187 tests previos, sin tests nuevos
187 passed, 3 warnings in 365.58s

$ pytest -q tests/test_gestion_cuentas.py  # 10 tests nuevos
10 passed, 1 warning in 21.75s

$ pytest -q                              # suite completa junta
197 passed, 3 warnings in 385.60s
```

`tests/test_gestion_cuentas.py` (10 casos) cubre las 3 piezas:

- **Pieza 1 (reset-password):** admin resetea y la contraseña vieja deja
  de servir mientras la nueva sí funciona; `directivo` recibe `403`;
  `id_personal` inexistente da `404`; contraseña `< 8` caracteres da
  `422`.
- **Pieza 2 (bloqueo):** `PUT /personal/{id}` con `estatus='bloqueado'`
  devuelve `200` y el login subsecuente da `401`; un valor de `estatus`
  fuera del enum da `422` (antes de tocar la base, gracias al `Literal`
  en `PersonalUpdate`).
- **Pieza 3 (log de accesos):** genera 5 intentos reales (éxito,
  password incorrecta, email inexistente, cuenta de baja, cuenta
  bloqueada) y confirma que `GET /log-acceso?id_personal=` devuelve el
  historial completo, en orden, con el `motivo_fallo` correcto en cada
  fila; `docente`/`directivo` reciben `403` en `GET /log-acceso`;
  `PUT`/`DELETE /log-acceso` dan `405` (ruta sin esos métodos
  registrados); UPDATE/DELETE/INSERT directo a la tabla, con sesión
  `admin` real vía `sige_app`, quedan bloqueados por RLS (mismo patrón
  del Punto 1d, pero ejercido a través del flujo HTTP real primero).

## Punto 3 — Verificación end-to-end con `curl`, sin frontend

Contra el stack de `docker-compose` reconstruido con el código nuevo
(`docker-compose build app && docker-compose up -d app`), usando las
credenciales de desarrollo (`docs/dev/seed-credentials.md`,
`db/seed_dev.py`).

### 1. Admin resetea la contraseña del docente del seed

```
$ curl -s -X POST http://127.0.0.1:8000/auth/login -d \
  '{"email_institucional":"admin@cobao.edu.mx","password":"Admin123!"}'
→ 200, access_token real

$ curl -s http://127.0.0.1:8000/personal -H "Authorization: Bearer <admin>" \
  | jq '.[] | select(.email_institucional=="docente@cobao.edu.mx") | .id_personal'
5

$ curl -s -X PUT http://127.0.0.1:8000/personal/5/reset-password \
  -H "Authorization: Bearer <admin>" -d '{"nueva_password":"NuevaPass123!"}'
→ 200 {"id_personal":5, "estatus":"activo", ...}
```

### 2. El docente se loguea con la nueva contraseña

```
$ curl -s -X POST http://127.0.0.1:8000/auth/login -d \
  '{"email_institucional":"docente@cobao.edu.mx","password":"NuevaPass123!"}'
→ 200, access_token real
```

### 3. Admin bloquea esa misma cuenta y el login ahora falla

```
$ curl -s -X PUT http://127.0.0.1:8000/personal/5 \
  -H "Authorization: Bearer <admin>" -d '{"estatus":"bloqueado"}'
→ 200 {"id_personal":5, "estatus":"bloqueado", ...}

$ curl -s -X POST http://127.0.0.1:8000/auth/login -d \
  '{"email_institucional":"docente@cobao.edu.mx","password":"NuevaPass123!"}'
→ 401 {"detail":"Credenciales inválidas"}
```

### 4. `GET /log-acceso` muestra ambos eventos con los datos correctos

```
$ curl -s "http://127.0.0.1:8000/log-acceso?id_personal=5" -H "Authorization: Bearer <admin>" | jq .
[
  {
    "id_log": 5,
    "email_intentado": "docente@cobao.edu.mx",
    "id_personal": 5,
    "exitoso": false,
    "motivo_fallo": "cuenta_bloqueada",
    "fecha_intento": "2026-08-16T18:16:31.053062"
  },
  {
    "id_log": 3,
    "email_intentado": "docente@cobao.edu.mx",
    "id_personal": 5,
    "exitoso": true,
    "motivo_fallo": null,
    "fecha_intento": "2026-08-16T18:16:23.116230"
  }
]
```

Exactamente lo pedido: el login exitoso anterior (paso 2, `exitoso:
true`, `motivo_fallo: null`) y el intento fallido tras el bloqueo (paso
3, `exitoso: false`, `motivo_fallo: "cuenta_bloqueada"`), ambos con el
`id_personal` correcto, más recientes primero.

Después de esta verificación se restauró la cuenta de desarrollo a su
estado normal (`estatus='activo'`, contraseña `Docente123!` original)
para no dejar el entorno de desarrollo roto para uso posterior.

### Nota operativa: la suite de pytest y el `docker-compose` local comparten la misma base

`tests/conftest.py::seed` hace `TRUNCATE ... CASCADE` sobre `personal`
(entre otras) al inicio de cada test — como los tests corrieron contra
el mismo Postgres que expone `docker-compose` en `127.0.0.1:5432`, cada
corrida de la suite borró temporalmente los datos de
`db/seed_dev.py` (`admin@cobao.edu.mx`, etc.). Se reejecutó
`python3 db/seed_dev.py` (idempotente, `ON CONFLICT DO NOTHING`) antes
de cada verificación con `curl` para restaurar las cuentas de
desarrollo. No es un bug de esta feature — es el mismo comportamiento
que ya documentó `docs/validacion/reporte-incidencia.md` (Punto 2,
"Suite de pytest") para no destruir seed manual.

## Decisión de diseño documentada aparte

`docs/decisions/ADR-011.md` — por qué `fn_registrar_intento_login` es
una función `SECURITY DEFINER` separada de `fn_login_lookup` (ADR-007),
en vez de ampliar esta última: `fn_login_lookup` está documentada como
"solo lectura" en ADR-007, y su filtro `estatus = 'activo'` interno
oculta justo la distinción (`bloqueada` vs. `baja` vs. inexistente) que
`motivo_fallo` necesita — ampliarla habría significado romper ambas
invariantes de una función ya validada en Fase 0/1, sin necesidad real
para lograr el objetivo de esta feature. Incluye también el detalle del
`db.commit()` explícito en `authenticate_personal`
(`app/core/security.py`), necesario para que la fila de `log_acceso` de
un intento **fallido** sobreviva al `rollback()` que dispara la
`HTTPException(401)` del login fallido en `get_db`.

## Conclusión

Las 3 piezas de Gestión de Cuentas (backend) quedan cerradas y
verificadas con el mismo rigor de siempre — RLS validada directo contra
Postgres con `sige_app` antes de escribir FastAPI, suite completa en
verde (197 tests, sin regresiones), y verificación end-to-end con `curl`
contra el stack real (sin frontend, según el alcance de este trabajo):

1. `PUT /personal/{id}/reset-password` — solo admin, hashea con
   `hash_password` (mismo patrón que el alta de personal).
2. `estatus='bloqueado'` — `CHECK` nuevo en BD, `fn_login_lookup` ya lo
   rechaza sin cambios (verificado, no asumido), `PersonalUpdate` lo
   acepta como valor válido.
3. `log_acceso` — historial completo (éxitos y fallos, nunca la
   contraseña), solo admin lee, inmutable, único camino de escritura
   `fn_registrar_intento_login` (ADR-011).

Frontend queda pendiente para un siguiente paso, según lo acordado.
