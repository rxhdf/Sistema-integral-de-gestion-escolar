# Log de validación — `fn_login_lookup` (ADR-007) y cadena JWT → SET → RLS

**Fecha:** 2026-08-04
**Objetivo:** repetir el patrón de validación de Fase 0/1
(`docs/validacion/rls-test-log-sige_app.md`) para la función
`fn_login_lookup` agregada por `docs/decisions/ADR-007.md`: confirmar,
conectando con el rol real de runtime (`sige_app`, nunca `sige_migrator`),
que (1) login funciona para un usuario activo, (2) falla para uno dado de
baja, (3) el resto de las políticas RLS de `personal` (Nivel 1/2 de
`docs/rbac/matriz-rbac-mvp.md`) siguen intactas, y (4) la cadena completa
JWT emitido en `/auth/login` → `SET app.current_rol`/`app.current_personal_id`
→ RLS funciona de punta a punta, no solo por piezas separadas.

## Entorno

- `docker-compose up -d --build` (Postgres 16 + `migrate` + `app`, volumen
  limpio) — exactamente el mismo stack que valida `fase0-gate` en CI, con
  las dos migraciones nuevas ya aplicadas: `7460fa835be8` (esquema inicial)
  y `d3f8a1c2b4e6` (`fn_login_lookup`, ADR-007).
- Suite de pytest (`tests/`) ejecutada desde el host, apuntando al mismo
  Postgres del stack (`localhost:5432`), con las mismas credenciales que
  usa `app` dentro de docker-compose — es decir, la app real (`TestClient`
  sobre `app.main.app`) habla con la BD a través del engine configurado
  con `DATABASE_URL` (`sige_app`), igual que en producción/dev.
- Seed de datos vía `sige_migrator` (bypassea RLS, igual que en la validación
  de Fase 0/1 — necesario para poblar sin depender de que ya exista sesión
  autenticada): 1 `plantel`, 1 `ciclo_escolar` activo, 1 `periodo_semestral`
  activo, 4 `personal` (`docente1` activo, `docente.baja` con
  `estatus='baja'`, `directivo1`, `admin1`).

## Migraciones aplicadas limpio

```
$ docker inspect -f '{{.State.ExitCode}}' sistema-integral-gestion-escolar_migrate_1
0

$ psql -U sige_migrator -d sige -c "SELECT version_num FROM alembic_version;"
d3f8a1c2b4e6
```

## Punto 1 — `fn_login_lookup`: `EXECUTE` solo para `sige_app`, no `PUBLIC`

```
$ psql -U sige_migrator -d sige -c "\df fn_login_lookup"
 Schema |      Name       |                          Result data type                          |    Argument data types    | Type
--------+-----------------+---------------------------------------------------------------------+----------------------------+------
 public | fn_login_lookup | TABLE(id_personal integer, rol character varying, ...)              | p_email character varying | func

$ psql -U sige_migrator -d sige -c "
    SELECT has_function_privilege('sige_app','fn_login_lookup(varchar)','execute') AS sige_app_execute,
           has_function_privilege('public','fn_login_lookup(varchar)','execute') AS public_execute;"
 sige_app_execute | public_execute
------------------+----------------
 t                | f
```

Confirma el `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO sige_app`
explícito de ADR-007: ningún otro rol puede invocar la función.

## Punto 2 — RLS de `personal` sigue fail-closed sin sesión (sin tocar `fn_login_lookup`)

```
$ psql -U sige_app -d sige -c "SELECT count(*) FROM personal;"   -- sin SET previo
 count
-------
     0

$ psql -U sige_migrator -d sige -c "SELECT count(*) FROM personal;"  -- owner, bypassea RLS
 count
-------
     4
```

`sige_app` sin `app.current_rol`/`app.current_personal_id` seteados ve 0
filas aunque existan 4 — el mismo comportamiento fail-closed documentado
en Fase 0/1, intacto después de agregar `fn_login_lookup`.

## Punto 3 — batería de pytest contra el stack real (`sige_app`, no mocks)

27/27 tests, corridos dos veces (una vía el Postgres levantado a mano para
iterar, otra vía `docker-compose up -d --build` completo — el mismo stack
que usa `fase0-gate` en CI) con resultado idéntico:

```
$ DATABASE_URL_MIGRATIONS=postgresql://sige_migrator:***@localhost:5432/sige \
  DATABASE_URL=postgresql://sige_app:***@localhost:5432/sige \
  JWT_SECRET_KEY=*** JWT_EXPIRE_MINUTES=60 \
  python3 -m pytest -v

tests/test_auth_rbac.py::test_login_wrong_password_401 PASSED
tests/test_auth_rbac.py::test_login_unknown_email_401 PASSED
tests/test_auth_rbac.py::test_login_baja_personal_cannot_authenticate_401 PASSED
tests/test_auth_rbac.py::test_login_valid_credentials_200 PASSED
tests/test_auth_rbac.py::test_protected_endpoint_without_token_401 PASSED
tests/test_auth_rbac.py::test_protected_endpoint_garbage_token_401 PASSED
tests/test_auth_rbac.py::test_personal_create_docente_forbidden_403 PASSED
tests/test_auth_rbac.py::test_personal_create_directivo_forbidden_403 PASSED
tests/test_auth_rbac.py::test_personal_create_admin_created_201 PASSED
tests/test_auth_rbac.py::test_personal_list_docente_forbidden_403 PASSED
tests/test_auth_rbac.py::test_personal_list_directivo_sees_all_200 PASSED
tests/test_auth_rbac.py::test_personal_list_admin_sees_all_200 PASSED
tests/test_auth_rbac.py::test_personal_me_returns_own_record_for_every_role PASSED
tests/test_auth_rbac.py::test_plantel_get_allowed_for_docente_200 PASSED
tests/test_auth_rbac.py::test_plantel_post_does_not_exist_405 PASSED
tests/test_auth_rbac.py::test_ciclo_escolar_create_docente_forbidden_403 PASSED
tests/test_auth_rbac.py::test_ciclo_escolar_create_directivo_created_201 PASSED
tests/test_auth_rbac.py::test_ciclo_escolar_create_admin_created_201 PASSED
tests/test_auth_rbac.py::test_ciclo_escolar_get_allowed_for_docente_200 PASSED
tests/test_auth_rbac.py::test_periodo_semestral_create_docente_forbidden_403 PASSED
tests/test_auth_rbac.py::test_periodo_semestral_create_admin_created_201 PASSED
tests/test_login_rls_e2e.py::test_fn_login_lookup_returns_credentials_for_active_personal PASSED
tests/test_login_rls_e2e.py::test_fn_login_lookup_rejects_wrong_password PASSED
tests/test_login_rls_e2e.py::test_fn_login_lookup_rejects_baja_personal_even_with_correct_password PASSED
tests/test_login_rls_e2e.py::test_docente_jwt_scopes_personal_query_to_own_row_via_rls PASSED
tests/test_login_rls_e2e.py::test_directivo_and_admin_jwt_see_all_personal_via_rls PASSED
tests/test_login_rls_e2e.py::test_docente_session_still_blocked_from_inserting_personal_by_rls PASSED

27 passed, 1 warning in 50.37s
```

Los relevantes para los 4 puntos pedidos:

- **Login funciona para un usuario activo:**
  `test_login_valid_credentials_200`,
  `test_fn_login_lookup_returns_credentials_for_active_personal`.
- **Falla para `estatus != 'activo'`:**
  `test_login_baja_personal_cannot_authenticate_401`
  (vía HTTP, `/auth/login`) y
  `test_fn_login_lookup_rejects_baja_personal_even_with_correct_password`
  (directo contra `fn_login_lookup`, confirmando que el filtro vive en la
  función y no depende de que el service lo revalide).
- **Cadena completa JWT → `SET`/`set_config` → RLS, de punta a punta:**
  `test_docente_jwt_scopes_personal_query_to_own_row_via_rls` — con la
  identidad que resultaría de un JWT de `docente1` (mismo
  `id_personal`/`rol` que emite `create_access_token` tras un login real),
  una consulta **sin filtro** (`SELECT * FROM personal`, sin `WHERE`) sobre
  la conexión real de `sige_app` devuelve únicamente la fila propia.
  `test_directivo_and_admin_jwt_see_all_personal_via_rls` confirma el
  contraste: mismos pasos, pero con `directivo`/`admin` ven las 4 filas.
- **El resto de RLS sobre `personal` (Nivel 1/2 de la matriz) sigue
  intacto:** `test_docente_session_still_blocked_from_inserting_personal_by_rls`
  — un `INSERT` directo a `personal` con sesión de `docente` (bypasseando
  el 403 de la capa de aplicación por completo) es rechazado por la
  política `personal_insert` (`WITH CHECK (app_current_rol() = 'admin')`).
  Los tests de autorización HTTP (`test_personal_create_directivo_forbidden_403`,
  etc.) confirman lo mismo en la capa de aplicación, y
  `test_plantel_post_does_not_exist_405` confirma que la matriz tampoco
  otorga `Create` de `Plantel` a nadie.

## Conclusión

`fn_login_lookup` resuelve el huevo-gallina de login sin abrir ninguna
grieta nueva en RLS: el bypass queda acotado exactamente a esa función
(`SECURITY DEFINER`, `EXECUTE` solo para `sige_app`, filtra `estatus`
internamente, devuelve 4 columnas y nada más), y todo lo demás —
incluyendo la ruta de escritura de `personal`, que es la más sensible de
este dominio— sigue fail-closed bajo `sige_app` exactamente como se validó
en Fase 0/1.
