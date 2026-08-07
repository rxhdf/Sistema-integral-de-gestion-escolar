# Cierre de Fase 5 — Calificaciones y Auditoría

**Fecha:** 2026-08-06
**Estado:** Fase 5 (`Calificacion`, `Auditoria_Calificacion`) cerrada.
Con esto, todas las entidades del MVP (ADR-002) están implementadas.

Este documento consolida el cierre completo de Fase 5 en el mismo formato
que `docs/validacion/fase-0-cierre.md`, `fase-02-organizacional-personal-auth.md`,
`fase-03-academico.md` y `fase-04-alumnos.md`. El detalle turno-por-turno
de cómo se llegó aquí (incluyendo los gaps de RLS encontrados durante la
implementación) queda en `docs/validacion/fase-05-control-escolar.md`;
este archivo es la versión consolidada y definitiva.

## Punto 1 — Verificación de RLS antes de construir nada

Por instrucción explícita, antes de escribir una sola línea de
`app/domains/control_escolar/`, se auditaron las políticas RLS ya
existentes en `db/ddl_mvp.sql` para `calificacion` y
`auditoria_calificacion` — la lección de Fase 4 fue que `USING(true)` en
`expediente_academico_select` pasó desapercibido hasta que se buscó
explícitamente.

**`calificacion`: sin gaps, scope propio en las 3 políticas.**

- `calificacion_select`: `directivo`/`admin` ven todo el plantel;
  `docente` solo vía sus propias `grupo_asignatura`.
- `calificacion_insert`: `WITH CHECK` exige `rol = 'docente' AND` la
  `grupo_asignatura` sea propia — excluye correctamente a
  `directivo`/`admin` de *crear* calificaciones (Nivel 1 de la matriz:
  ellos solo tienen R, U; ADR-004 habla de *corregir*, no de capturar).
- `calificacion_update`: mismo scope que `select` (Postgres reutiliza
  `USING` como `WITH CHECK` cuando no se especifica uno explícito para
  `UPDATE`, documentado así en la propia definición de Postgres).

**`auditoria_calificacion`: 1 gap encontrado, corregido antes de
construir encima.**

- `auditoria_calificacion_select`: correcta — `directivo`/`admin`
  solamente, cero acceso para `docente`.
- `auditoria_calificacion_insert`: tenía `WITH CHECK(true)`. El
  comentario original en el DDL reconocía la decisión ("el control real
  vive en la lógica de aplicación, no en RLS") — consciente en su
  momento, no un descuido, pero el mismo patrón de fondo que el gap de
  Fase 4: cualquier sesión autenticada (`docente` incluido) podía
  insertar una fila de auditoría suplantando cualquier
  `id_personal_capturo`/`id_personal_modifico`.

**Corrección aplicada antes de escribir el dominio** (migración
`f7e7a1890dcc`, encadenada tras `dac93954f640` de Fase 4): el `INSERT`
ahora exige que el autor coincida con la sesión —

```sql
WITH CHECK (
    CASE accion
        WHEN 'captura'    THEN id_personal_capturo  = app_current_personal_id()
        WHEN 'correccion' THEN id_personal_modifico = app_current_personal_id()
    END
);
```

No duplica la regla de negocio completa de quién puede capturar/corregir
(eso lo decide `calificacion_insert`/`calificacion_update` + el service)
— solo impide que la fila mienta sobre quién la insertó.

## Punto 2 — Qué se implementó

Dominio `app/domains/control_escolar/` completo (`models.py`,
`schemas.py`, `repository.py`, `service.py`, `router.py`), siguiendo el
patrón de auth/RLS de fases anteriores (`get_current_personal`,
`require_roles`):

- **`GET /calificacion`**: abierto a los 3 roles; scope real resuelto
  por RLS (`docente` ve solo las suyas, `directivo`/`admin` todo el
  plantel) — sin filtro adicional en Python.
- **`POST /calificacion`**: restringido a `docente`
  (`require_roles("docente")` + `calificacion_insert`). Si el
  `id_grupo_asig` enviado pertenece a otro docente, `RLS` lo rechaza y
  `GrupoAsignaturaAjenoError` lo traduce a `403` limpio (mismo patrón
  que `DocenteInvalidoError` de Fase 3) — antes de esta corrección
  devolvía un `500` sin explicación.
- **`PUT /calificacion/{id}`**: abierto a los 3 roles; `docente` corrige
  su propia captura, `directivo`/`admin` corrigen cualquiera del plantel
  (ADR-004). Un `docente` fuera de su `grupo_asignatura` recibe `404`,
  no `403` — la fila es invisible por RLS (decisión explícita confirmada
  con el usuario: mismo patrón de opacidad ya usado en
  `alumno`/`expediente_academico`, en vez de agregar una consulta aparte
  solo para distinguir "no existe" de "existe pero no es tuya").
- **ADR-005 — cálculo**: `calificacion_final` = promedio de los
  **parciales disponibles** (no exige los 3) — queda `NULL` y
  `estatus = 'pendiente'` solo si ninguno de los 3 se ha capturado
  todavía. `estatus` = `aprobado` si `calificacion_final >= 6`, si no
  `reprobado` — umbral marcado explícitamente en el código
  (`UMBRAL_APROBADO`, `app/domains/control_escolar/service.py`) como
  **asumido, sin confirmar** con el plantel piloto
  (`docs/data_dictionary/mvp.md` #3). `Expediente_Academico.promedio_actual`
  se recalcula como promedio de las `calificacion_final` no nulas del
  alumno, en cada captura/corrección.
- **ADR-004 — auditoría**: cada `INSERT` en `Calificacion` genera una
  fila en `Auditoria_Calificacion` con `accion='captura'` e
  `id_personal_capturo`; cada `UPDATE` genera una fila con
  `accion='correccion'`, `id_personal_modifico`, y
  `valores_anteriores`/`valores_nuevos` (JSONB) con el estado
  antes/después.
- **`GET /auditoria-calificacion`**: solo `directivo`/`admin`
  (`require_roles` + `auditoria_calificacion_select`).

## Punto 3 — Gaps adicionales, solo visibles al ejercer el flujo real como docente

El análisis estático del Punto 1 no los mostró — aparecieron al correr
los primeros tests con la sesión del rol menos privilegiado, no con
`admin`:

1. **`RETURNING` vs. política `SELECT`**: `db.flush()` del ORM usa
   `INSERT ... RETURNING` para poblar `id_auditoria`/`fecha_evento`.
   Postgres evalúa la política `SELECT` sobre la fila que `RETURNING`
   devolvería, y esa política niega todo acceso a `docente` por diseño
   — el `INSERT` de un docente, que sí pasaba el `WITH CHECK` del Punto
   1, fallaba igual. Corregido: `repository.create_auditoria` inserta
   con SQL crudo, sin `RETURNING` (nadie usa ese id de vuelta).

2. **`promedio_actual` bloqueado para docente**: `expediente_academico_write`
   restringe `UPDATE` a `directivo`/`admin` (correcto, Nivel 1 de la
   matriz: docente solo tiene `R` sobre `Expediente_Academico`). Pero
   ADR-005 exige recalcular `promedio_actual` en cada captura, y la más
   común es un docente sobre su propia calificación. Corregido con
   `fn_actualizar_promedio_actual` (`SECURITY DEFINER`, migración
   `3698a658047c`, mismo patrón que ADR-007): acotada a esa única
   columna derivada, no abre escritura general de `Expediente_Academico`
   a docente.

**Lección**: el análisis estático de RLS (Punto 1) encuentra gaps de
diseño tipo `USING(true)`/`WITH CHECK(true)` — necesario, pero no
suficiente. Antes de cerrar cualquier fase que agregue escritura nueva:
correr el flujo completo como el rol con menos permisos, no solo como
`admin`.

## Punto 4 — Append-only de `Auditoria_Calificacion`, verificado con el mismo rigor de Fase 4

- **Sin endpoint `PUT`/`DELETE`**: el router solo expone `GET`. Confirmado
  con `test_auditoria_calificacion_put_does_not_exist_405` /
  `..._delete_does_not_exist_405` (mismo patrón que
  `test_plantel_post_does_not_exist_405`) — `405`, no `404` ni `500`.
- **Sin política RLS de `UPDATE`/`DELETE`**: solo existen
  `auditoria_calificacion_select` e `..._insert`. Sin política para un
  comando, Postgres deniega por defecto — verificado primero a mano por
  `psql` (`UPDATE 0`, `DELETE 0` incluso como `admin`), y luego con
  `test_auditoria_update_direct_blocked_for_all_roles` /
  `..._delete_direct_blocked_for_all_roles`: iteran los 3 roles vía SQL
  crudo (bypasseando el service), confirman `rowcount == 0` en cada
  intento — incluido `admin`, que no es superusuario ni owner
  (`sige_app` es `NOSUPERUSER`, ADR-006) — y que la fila no cambia.

## Verificación completa: suite completa contra Postgres real

Corrida completa, `docker-compose up` (local, no CI), 2026-08-06:

```
================== 135 passed, 1 warning in 131.32s (0:02:11) ==================
```

Desglose: 95 de fases anteriores (Fase 0-4) + 26 en
`tests/test_control_escolar.py` (RBAC, scope, ADR-004/005, 403 de
`grupo_asignatura` ajeno, bypass directo de RLS en `auditoria_calificacion`,
append-only) + 14 en `tests/test_control_escolar_calculo.py` (unitarios,
sin BD: `_calificacion_final`/`_estatus` — promedio simple, parciales
nulos, redondeo, umbral).

CI de GitHub Actions sigue pendiente de confirmación por la falla de
dispatch externa ya documentada en
`docs/validacion/ci-dispatch-outage-2026-08-06.md` — no bloqueante, no
relacionada con el código de esta fase.

## Qué queda fuera de Fase 5 (a propósito)

- **Umbral de aprobado/reprobado**: sigue asumido `>=6`, sin confirmar
  con plantel piloto (`docs/data_dictionary/mvp.md` #3, `CLAUDE.md`).
- **Regla de faltantes de `calificacion_final`**: definida en esta fase
  (promedia sobre los parciales disponibles, no exige los 3) porque
  ADR-005 la dejaba abierta — revisable si el negocio prefiere exigir
  los 3 antes de dar un resultado.
- **2 docentes por `Grupo_Asignatura`**: sigue sin resolver, no
  específico de esta fase.
- **`motivo_correccion` en `Auditoria_Calificacion`**: descartado a
  propósito en ADR-004 para el MVP.

## Conclusión

Dominio `control_escolar` implementado. RLS auditada explícitamente
antes de construir (1 gap encontrado y corregido de inmediato); 2 gaps
adicionales encontrados y corregidos al ejercer el flujo real como
docente (no visibles en el análisis estático); cálculo de ADR-005
corregido a la regla de "parciales disponibles"; `POST /calificacion`
devuelve `403` limpio en vez de `500` para `grupo_asignatura` ajeno;
`auditoria_calificacion` confirmada append-only a nivel de API y de RLS,
para los 3 roles sin excepción. **135 tests pasando contra Postgres
real. Fase 5 formalmente cerrada — con esto, el backend del MVP completo
(ADR-002) está implementado.**
