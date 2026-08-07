# Cierre de Fase 5 — Control Escolar (Calificaciones + Auditoría)

**Fecha:** 2026-08-06
**Estado:** Fase 5 (`Calificacion`, `Auditoria_Calificacion`) cerrada.

Antes de implementar nada de `control_escolar`, se auditaron explícitamente
las políticas RLS de ambas tablas en `db/ddl_mvp.sql`, por la lección de
Fase 4 (`expediente_academico_select` tenía `USING(true)`). Esa auditoría
encontró **tres** gaps distintos — uno de diseño (documentado abajo) y dos
que solo aparecieron al ejercer el flujo real con un docente autenticado,
no con `sige_migrator`/`sige_app` sin `SET` de sesión. Los tres se
corrigieron con su propia migración Alembic, encadenada, antes de dar por
cerrada la fase.

## Punto 1 — Auditoría de RLS existente (`calificacion`)

Sin gaps. Las tres políticas ya tenían scope propio, no `USING(true)`:

- `calificacion_select`: `directivo/admin` todo el plantel; `docente` solo
  vía sus `grupo_asignatura`.
- `calificacion_insert`: `WITH CHECK` exige `rol = 'docente' AND` la
  `grupo_asignatura` propia — excluye correctamente a `directivo`/`admin`
  de *crear* calificaciones (Nivel 1: ellos solo tienen R, U — coherente
  con ADR-004, que habla de *corregir*, no de capturar de cero).
- `calificacion_update`: mismo scope que `select` (sin `WITH CHECK`
  explícito — Postgres reutiliza `USING` como `WITH CHECK` cuando no se
  especifica, documentado así).

## Punto 2 — Gap encontrado: `auditoria_calificacion_insert` con `WITH CHECK(true)`

A diferencia del gap de Fase 4, éste tenía un comentario reconociendo la
decisión ("el control real vive en la lógica de aplicación, no en RLS")
— consciente en su momento, no un descuido. Pero es el mismo patrón de
fondo: cualquier sesión autenticada (docente incluido) podía insertar una
fila de auditoría suplantando cualquier `id_personal_capturo`/
`id_personal_modifico`, con cualquier `accion` y cualquier
`valores_anteriores`/`valores_nuevos`. Ahora que Fase 5 empieza a escribir
de verdad en esta tabla, se corrigió antes de construir encima.

**Corrección** (migración `f7e7a1890dcc`, encadenada tras `dac93954f640`
de Fase 4): `WITH CHECK` ahora exige que quien inserta sea quien dice ser
— `accion = 'captura'` requiere `id_personal_capturo = app_current_personal_id()`;
`accion = 'correccion'` requiere `id_personal_modifico = app_current_personal_id()`.
No duplica la regla completa de negocio (eso lo sigue decidiendo
`calificacion_insert`/`calificacion_update` + el service) — solo impide
que la fila mienta sobre el autor.

## Punto 3 — Gap encontrado al ejercer el flujo real: `RETURNING` + `auditoria_calificacion_select`

No estaba en el análisis estático de políticas — apareció al correr el
primer test de un docente capturando una calificación. `db.flush()` del
ORM (SQLAlchemy) usa `INSERT ... RETURNING` internamente para poblar
`id_auditoria`/`fecha_evento`. Postgres evalúa la política **SELECT**
sobre la fila que `RETURNING` devolvería — y `auditoria_calificacion_select`
niega **todo** acceso a `docente` por diseño ("sin acceso para docente").
Resultado: el `INSERT` de un docente, que sí pasaba el nuevo `WITH CHECK`
del Punto 2, fallaba igual con "violates row-level security policy",
porque no podía leerse de vuelta.

**Corrección**: `app/domains/control_escolar/repository.py::create_auditoria`
ahora hace un `INSERT` con SQL crudo, sin `RETURNING` — nadie en
`service.py` usa el `id_auditoria`/`fecha_evento` generados, así que
evitar `RETURNING` resuelve el problema sin tocar (ni debilitar)
`auditoria_calificacion_select`, que se queda exactamente como estaba
diseñada: cero acceso de lectura para docente.

## Punto 4 — Gap encontrado al ejercer el flujo real: recalcular `promedio_actual` bloqueado para docente

Mismo mecanismo que el Punto 3, pero sobre `expediente_academico_write`
(`UPDATE` restringido a `directivo`/`admin`, Nivel 1: docente solo tiene
`R` sobre `Expediente_Academico`). ADR-005 exige que el service
recalcule `promedio_actual` en **cada** captura/corrección de
`Calificacion` — el caso más común es un docente capturando su propia
calificación. Ese docente no tiene ni debe tener permiso para editar
`Expediente_Academico` en general, pero la RLS tal cual estaba también
bloqueaba esta escritura derivada y automática, dejando el sistema
incapaz de cumplir ADR-005 en el flujo normal.

**Corrección** (migración `3698a658047c`, mismo patrón que ADR-007):
`fn_actualizar_promedio_actual(id_alumno, promedio)`, `SECURITY DEFINER`,
acotada a **una sola columna derivada** (`promedio_actual`, calculada en
Python por ADR-005, nunca editable a mano vía API por ningún rol) — no
abre una vía para modificar `situacion_academica`, `escuela_procedencia`
ni ningún otro campo. `service.py::_recalcular_promedio_expediente` la
llama en vez de hacer `UPDATE` por ORM.

## Qué se implementó

Dominio `app/domains/control_escolar/` completo:

- **`Calificacion`**: `GET` abierto a los 3 roles (scope vía RLS);
  `POST` solo `docente` (`require_roles("docente")` + `calificacion_insert`);
  `PUT` abierto a los 3 roles, con el scope real resuelto por RLS
  (`docente` fuera de su `grupo_asignatura` recibe 404, no 403 — la fila
  es invisible, mismo patrón de opacidad ya usado en `alumnos`).
- **ADR-005**: `calificacion_final` = promedio de los **parciales
  disponibles** (no exige los 3) — `calificacion_final = NULL` y
  `estatus = 'pendiente'` solo cuando ninguno de los 3 se ha capturado
  todavía (regla de faltantes que ADR-005 dejaba abierta; corregida a
  esta versión tras revisión — la primera implementación exigía los 3,
  ver historial de este documento). `estatus` = `aprobado` si
  `calificacion_final >= 6`, si no `reprobado` — umbral **asumido, sin
  confirmar** (`docs/data_dictionary/mvp.md` #3, mismo pendiente marcado
  en `CLAUDE.md`). `Expediente_Academico.promedio_actual` se
  recalcula como promedio de las `calificacion_final` no nulas del
  alumno, en cada captura/corrección.
- **ADR-004**: cada captura genera `Auditoria_Calificacion` con
  `accion='captura'`, `id_personal_capturo`; cada corrección genera una
  fila con `accion='correccion'`, `id_personal_modifico`,
  `valores_anteriores`/`valores_nuevos` (JSONB) con el estado antes/después.
- **`GET /auditoria-calificacion`**: solo `directivo`/`admin`
  (`require_roles` + `auditoria_calificacion_select`).

## Tests: 19 nuevos en `tests/test_control_escolar.py`

RBAC (GET abierto, POST solo docente, PUT con scope), cálculo ADR-005
(pendiente/aprobado/reprobado), recalculo de `promedio_actual`, auditoría
generada en captura y corrección, `GET /auditoria-calificacion` prohibido
a docente, y **dos pruebas de bypass directo** (mismo patrón que Fase 4,
`tests/test_login_rls_e2e.py::_set_session`) que consultan/insertan
directo contra `auditoria_calificacion` sin pasar por el service:

- `test_auditoria_direct_insert_impersonation_blocked_by_rls`: un docente
  intentando insertar una fila de auditoría con `id_personal_capturo` de
  **otro** personal — bloqueado.
- `test_auditoria_direct_insert_own_identity_allowed_by_rls`: el mismo
  docente insertando con su propia identidad — permitido (confirma que el
  fix no sobre-restringe).

## Verificación completa

**114 passed** (95 previos + 19 nuevos) contra Postgres real, local
(`docker-compose up --build`, necesario en cada corrida por las 3
migraciones nuevas):

```
================== 114 passed, 1 warning in 121.11s (0:02:01) ==================
```

CI de GitHub Actions sigue pendiente de confirmación por la falla de
dispatch documentada en `docs/validacion/ci-dispatch-outage-2026-08-06.md`.

## Lección para fases futuras

El análisis estático de políticas RLS (leer `db/ddl_mvp.sql`) encuentra
gaps de diseño tipo `USING(true)`/`WITH CHECK(true)` — necesario, pero no
suficiente. Dos de los tres gaps de esta fase (`RETURNING` vs. política
SELECT, `UPDATE` derivado bloqueado por una política de escritura
correcta para el caso humano) **solo aparecen al ejercer el flujo real
con la sesión del rol menos privilegiado** (aquí, un docente). Antes de
cerrar cualquier fase que agregue escritura nueva: correr el flujo
completo como el rol con menos permisos, no solo como `admin`.

## Qué queda fuera de Fase 5 (a propósito)

- **Umbral de aprobado/reprobado**: sigue asumido `>=6`, sin confirmar
  con plantel piloto (`CLAUDE.md`).
- **Regla de faltantes de `calificacion_final`**: se definió aquí porque
  ADR-005 la dejaba abierta — se promedia sobre los parciales
  disponibles (no exige los 3); solo queda `NULL`/`pendiente` si ninguno
  se ha capturado. Revisable si el negocio prefiere exigir los 3 antes
  de dar un resultado.
- **2 docentes por `Grupo_Asignatura`**: sigue sin resolver, no
  específico de esta fase.
- **`motivo_correccion` en `Auditoria_Calificacion`**: descartado a
  propósito en ADR-004 para el MVP.

## Conclusión

Dominio `control_escolar` implementado; 3 gaps de RLS encontrados y
corregidos con evidencia real antes y durante la implementación (dos de
ellos solo visibles ejerciendo el flujo con sesión de docente, no con
análisis estático); 114 tests pasando, incluyendo bypass directo de la
capa de servicio para el fix de auditoría. **Fase 5 formalmente cerrada.**

## Actualización — regla de faltantes + gap de POST sin traducir (2026-08-06)

Dos cambios posteriores al cierre inicial:

1. **Regla de faltantes de `calificacion_final` corregida**: la primera
   versión exigía los 3 parciales para calcular un promedio; ADR-005
   dejaba esa regla abierta, y el criterio correcto es promediar sobre
   los parciales **disponibles** — `calificacion_final` solo queda
   `NULL`/`pendiente` si ninguno de los 3 se ha capturado. 14 tests
   unitarios nuevos en `tests/test_control_escolar_calculo.py` (sin BD,
   prueban `_calificacion_final`/`_estatus` directo).

2. **Gap encontrado al escribir el test "docente A no puede escribir en
   `grupo_asignatura` de docente B"**: `POST /calificacion` no traducía
   el rechazo de `calificacion_insert` (RLS) — un docente enviando un
   `id_grupo_asig` ajeno producía un `500` sin explicación, no un `403`
   limpio. Corregido con `GrupoAsignaturaAjenoError`
   (`app/domains/control_escolar/service.py`), mismo patrón que
   `DocenteInvalidoError` de Fase 3 (`academico/service.py`): captura
   `sqlalchemy.exc.ProgrammingError`, hace `rollback()`, y el router la
   traduce a `403`.

3. **Decisión explícita confirmada con el usuario**: `PUT /calificacion/{id}`
   se mantiene en `404` (no `403`) cuando un docente ataca la
   calificación de otro docente — consistente con el patrón de opacidad
   RLS ya usado en `alumno`/`expediente_academico`, en vez de agregar una
   consulta adicional solo para distinguir "no existe" de "existe pero no
   es tuya".

**131 passed** (129 previos + 2 nuevos: scope explícito de `GET
/calificacion` para docente, y el 403 de `grupo_asignatura` ajeno)
contra Postgres real, local.

## Actualización — append-only verificado con el mismo rigor de Fase 4 (2026-08-06)

Se re-verificó explícitamente, sin cambios de código (ya estaba bien
desde el diseño original de la tabla):

- **Sin endpoint `PUT`/`DELETE`** para `auditoria_calificacion` en
  `app/domains/control_escolar/router.py` — solo `GET`. Confirmado con
  `test_auditoria_calificacion_put_does_not_exist_405` /
  `..._delete_does_not_exist_405` (mismo patrón que
  `test_plantel_post_does_not_exist_405`): `405`, no `404` ni `500`.
- **Sin política RLS de `UPDATE`/`DELETE`** para `auditoria_calificacion`
  en `db/ddl_mvp.sql` — solo `auditoria_calificacion_select` y
  `..._insert`. Sin política para un comando, Postgres deniega por
  defecto: cualquier `UPDATE`/`DELETE` directo afecta **0 filas**, para
  cualquier rol, **incluido `admin`** (que no es superusuario ni owner —
  `sige_app` es `NOSUPERUSER`, ADR-006). Verificado empíricamente por
  `psql` antes de escribir el test, y luego con
  `test_auditoria_update_direct_blocked_for_all_roles` /
  `..._delete_direct_blocked_for_all_roles`: iteran los 3 roles con
  `_set_session` (bypasseando el service, SQL crudo), confirman
  `rowcount == 0` en cada intento, y que la fila sigue exactamente igual
  después.

**135 passed** (131 previos + 4 nuevos) contra Postgres real, local.
Ningún cambio de esquema — este punto ya estaba correctamente diseñado
desde `db/ddl_mvp.sql` original; lo que faltaba era la cobertura de test
explícita pedida.
