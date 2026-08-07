# Cierre de Fase 4 — Alumnos y Expedientes

**Fecha:** 2026-08-06
**Estado:** Fase 4 (Alumno, Expediente_Academico) cerrada. `Calificacion`
queda para una fase posterior (no se nombró como parte de este alcance).

## Punto 1 — Qué se implementó

Dominio `app/domains/alumnos/` completo, siguiendo el patrón de
auth/RLS de Fase 2/3 (`get_current_personal`, `require_roles`):

- **`Alumno`**: `GET` abierto a los 3 roles, con **dos schemas de salida**
  (matriz RBAC Nivel 3) — `AlumnoOutDocente` (sin `fecha_nacimiento`,
  `email`, `telefono_personal`) y `AlumnoOutDirectivo` (todos los campos).
  El router (`app/domains/alumnos/router.py`) elige el schema según
  `current.rol` y usa `response_model=None` + `.model_dump()` explícito —
  el campo oculto no sale del backend, no es solo que el frontend lo
  ignore. `POST`/`PUT`/`POST .../inscribir` restringidos a
  `directivo`/`admin`. Scope de docente reutiliza el RLS ya validado en
  Fase 3 (`alumno_select`, vía `grupo_asignatura`) sin filtro manual en
  Python.
- **`Expediente_Academico`**: sin filtrado de campos (ambos roles ven
  todo, por RBAC Nivel 3), pero con el mismo scope de fila que `Alumno`
  para docente.

## Punto 2 — Gap encontrado y corregido: RLS de `expediente_academico`

Durante la implementación, `expediente_academico_select` tenía
`USING(true)` en `db/ddl_mvp.sql` — el scope "docente solo ve expedientes
de sus alumnos" estaba resuelto únicamente en
`app/domains/alumnos/service.py::get_expediente` (consultando primero
`alumno`, que sí tiene RLS por fila, antes de leer el expediente).

**Eso protegía un único code path, no la tabla.** Cualquier query directa
a `expediente_academico` — un script, una sesión de agente que no
conociera este patrón, un endpoint nuevo que llamara a
`repository.get_expediente_by_alumno` sin pasar por el chequeo del
service — veía el expediente completo de cualquier alumno, sin importar
si el docente tenía relación con él o no.

Esto contradecía directamente `docs/decisions/ADR-001.md`, cuya razón de
ser es "aplicar políticas RLS por tabla completa (un docente nunca tiene
ni la posibilidad de hacer join a datos que no le corresponden)" — la
tabla separada existía, pero la política RLS no cumplía esa promesa.

**Corrección** (`db/ddl_mvp.sql` + migración Alembic
`dac93954f640_expediente_academico_select_scope_.py`, encadenada después
de `d3f8a1c2b4e6` de ADR-007): `expediente_academico_select` ahora aplica
el mismo scope que `alumno_select` — `directivo`/`admin` ven todo;
`docente` solo ve expedientes de alumnos en grupos donde tiene
`grupo_asignatura` activa — vía `id_alumno IN (SELECT ... JOIN
grupo_asignatura ...)`, el mismo patrón ya usado en `calificacion_select`.

Aplicada y verificada en Postgres real:

```sql
-- Antes:
expediente_academico_select | true
-- Después:
expediente_academico_select | ((app_current_rol() = ANY (ARRAY['directivo','admin']))
                             |  OR (id_alumno IN (SELECT a.id_alumno FROM alumno a
                             |      JOIN grupo_asignatura ga ON ga.id_grupo = a.id_grupo
                             |      WHERE ga.id_docente = app_current_personal_id())))
```

## Punto 3 — Test de bypass directo (sin pasar por el service)

`tests/test_alumnos.py`:

- `test_expediente_direct_query_docente_out_of_scope_blocked_by_rls`:
  autentica un docente sin `grupo_asignatura` sobre el grupo del alumno,
  fija la sesión de Postgres igual que `get_current_personal`
  (`_set_session`, reutilizado de `tests/test_login_rls_e2e.py`), y
  ejecuta `SELECT ... FROM expediente_academico` **crudo**, sin tocar
  `service.get_expediente` — confirma `0 filas`. Antes de la corrección
  este test habría fallado (la query cruda devolvía la fila).
- `test_expediente_direct_query_docente_in_scope_allowed_by_rls`: mismo
  mecanismo, con el docente sí autorizado — confirma `1 fila`, para
  probar que el fix no sobre-restringe.

## Punto 4 — Verificación completa

**95 passed** (68 previos + 27 de `test_alumnos.py`, incluyendo los 2 de
bypass RLS) contra Postgres real, local (`docker-compose up --build` —
necesario porque la imagen estaba cacheada sin la migración nueva):

```
=================== 95 passed, 1 warning in 98.98s (0:01:38) ===================
```

CI (GitHub Actions) sigue pendiente de confirmación por la falla de
dispatch documentada en
`docs/validacion/ci-dispatch-outage-2026-08-06.md` — no bloqueante, ya
justificado ahí.

## Qué queda fuera de Fase 4 (a propósito)

- **`Calificacion`, `Auditoria_Calificacion`**: no forman parte de este
  alcance (Fase 4 se acotó explícitamente a Alumno/Expediente_Academico).
  Quedan para la siguiente fase, junto con el umbral de aprobado/reprobado
  aún sin confirmar (`CLAUDE.md`).
- **2 docentes por `Grupo_Asignatura`**: sigue sin resolver, no específico
  de esta fase.

## Lección para fases futuras

Cuando una entidad tiene scope "igual que otra entidad" (aquí,
"expediente igual que alumno"), no basta con resolverlo en el service
reutilizando una consulta ya scopeada — si la tabla propia tiene su
propia política RLS, esa política debe expresar el mismo scope
explícitamente. Un service correcto y una tabla con RLS incorrecta
conviven sin error visible hasta que algo bypasea el service; RLS es la
garantía que no depende de que todo el código futuro conozca la regla.

## Conclusión

Dominio `alumnos` implementado, gap de RLS en `expediente_academico`
encontrado y corregido con evidencia real (95 tests, incluyendo bypass
directo de la capa de servicio), migración versionada
(`dac93954f640`). **Fase 4 (Alumnos y Expedientes) formalmente cerrada.**
