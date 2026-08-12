# SIGE MVP — Matriz RBAC

**Roles:** `docente`, `directivo`, `admin`

**Actualización respecto al diccionario de datos (`mvp.md`):** el campo
`Personal.rol` pasa de check `IN ('docente','directivo')` a
`IN ('docente','directivo','admin')`. Pendiente de aplicar en el diccionario
y en el DDL.

**Jerarquía de permisos:** `admin` ⊇ `directivo` ⊇ `docente` en todo lo
académico/operativo. La única diferencia entre `admin` y `directivo` es la
gestión de cuentas de `Personal`.

---

## Nivel 1: CRUD por entidad

| Entidad | Docente | Directivo | Admin |
|---|---|---|---|
| `Plantel` | R | R, U | R, U |
| `Ciclo_Escolar` | R | C, R, U | C, R, U |
| `Periodo_Semestral` | R | C, R, U | C, R, U |
| `Personal` | R (solo su propio registro) | R (todo el plantel, sin crear/editar/dar de baja) | C, R, U, D (crear, editar rol, dar de baja — incluye directivos) |
| `Grupo` | R | C, R, U | C, R, U |
| `Asignatura` | R | C, R, U | C, R, U |
| `Grupo_Asignatura` | R (solo las suyas) | C, R, U, D | C, R, U, D |
| `Alumno` | R | C, R, U | C, R, U |
| `Expediente_Academico` | R (campos limitados, ver Nivel 3) | C, R, U | C, R, U |
| `Calificacion` | C, R, U (solo de sus `Grupo_Asignatura`) | R, U (puede corregir calificación ya capturada por docente) | R, U (mismo alcance que directivo) |
| `Asistencia` (post-MVP, ADR-008) | C, R, U (solo de sus `Grupo_Asignatura`, ver nota) | R (mismo alcance que `Calificacion`) | R (mismo alcance que `Calificacion`) |

> **Nota — `Asistencia`, gap conocido (ADR-008):** el diseño
> (`docs/data_dictionary/asistencia.md`) le da a directivo/admin
> capacidad de `U` ("corregir cualquier registro ya capturado"), y la
> política RLS `asistencia_update` ya lo permite — pero no existe
> todavía un endpoint HTTP que lo ejerza (el único endpoint de
> escritura, `POST /asistencia/lote`, es `require_roles("docente")`
> únicamente). Esta fila queda marcada solo `R` para directivo/admin
> hasta que ese endpoint exista; no es un límite de RLS, es una entrega
> incompleta documentada.

> **Nota — `Plantel` sin `C`, pero con `U`:** ningún rol tiene `Create`
> sobre `Plantel`, ni siquiera `admin` — el MVP es de un solo plantel
> (`docs/data_dictionary/mvp.md` #1), y esa fila se crea vía seed/migración,
> no vía API. `app/domains/organizacional/router.py` no expone
> `POST /plantel` intencionalmente (bloqueo permanente, no un pendiente).
> El `U` de directivo/admin sí tiene endpoint: `PUT /plantel` (sin
> `{id_plantel}` en el path — es la única fila, no hay ambigüedad de cuál
> editar), sin scope adicional más allá de `require_roles("directivo",
> "admin")` dado que no hay más de una fila que filtrar.

---

## Nivel 2: Alcance (scope) por entidad con acceso restringido

| Entidad | Regla de "docente" | Regla de "directivo" / "admin" |
|---|---|---|
| `Personal` | `WHERE id_personal = current_user_id` | Todos los del `id_plantel` |
| `Grupo_Asignatura` | `WHERE id_docente = current_user_id` | Todos los del `id_plantel` (vía join a `Grupo`) |
| `Calificacion` | `WHERE id_grupo_asig IN (SELECT id_grupo_asig FROM grupo_asignatura WHERE id_docente = current_user_id)` | Todos los del `id_plantel` |
| `Alumno` (lectura) | Solo alumnos en algún `Grupo` donde el docente tiene `Grupo_Asignatura` activa | Todos los del `id_plantel` |
| `Asistencia` | `WHERE id_grupo_asig IN (SELECT id_grupo_asig FROM grupo_asignatura WHERE id_docente = current_user_id)` (idéntico a `Calificacion`) | Todos los del `id_plantel` |

`directivo` y `admin` comparten el mismo scope en todas las entidades
operativas/académicas — la diferencia entre ambos vive únicamente en el
Nivel 1 sobre `Personal`.

---

## Nivel 3: Campos visibles en entidades sensibles

### `Alumno` (datos `Ordinaria`)

| Campo | Docente ve | Directivo / Admin ve |
|---|---|---|
| `nombre`, `apellido_paterno`, `apellido_materno`, `matricula` | Sí | Sí |
| `curp` | Sí (solo la CURP, no otros datos personales) | Sí |
| `fecha_nacimiento`, `email`, `telefono_personal` | **No** | Sí |

### `Expediente_Academico` (datos `Académica-restringida`)

| Campo | Docente ve | Directivo / Admin ve |
|---|---|---|
| `situacion_academica` | Sí | Sí |
| `promedio_actual`, `promedio_secundaria`, `escuela_procedencia` | Sí — un docente puede ver el promedio general del alumno en todas las materias, no solo la suya. **Nota:** marcado explícitamente como decisión revisable a futuro; si se restringe después, es cambio de RLS/schema, no de estructura de tabla. | Sí |

### `Calificacion` (datos `Académica-restringida`)

Ya cubierto por el scope del Nivel 2 — quien puede ver la fila, ve todos sus
campos. No aplica ocultamiento de columnas dentro de la fila visible.

### `Personal`

El docente solo ve su propio registro completo (resuelto en Nivel 2); no
aplica ocultamiento adicional de campos sobre su propio registro.
`directivo` ve todos los campos de `Personal` del plantel salvo
`password_hash` (nunca expuesto a ningún rol vía API, sin excepción).

---

## Reglas de auditoría reforzada derivadas de esta matriz

Dado que `directivo`/`admin` pueden **modificar** una calificación ya
capturada por un docente (Nivel 1), la tabla de auditoría de `Calificacion`
debe registrar explícitamente:

- Si la modificación fue hecha por el mismo docente que la capturó originalmente, o por un `directivo`/`admin` (campo `id_personal_modifico` vs. `id_personal_capturo` original).
- Se recomienda no exigir motivo obligatorio en el MVP (para no bloquear flujo), pero si en producción se detectan correcciones frecuentes sin justificación, agregar campo `motivo_correccion` en iteración posterior.

---

## Resumen de decisiones confirmadas en esta sesión

1. **Directivo/Admin sí pueden modificar calificaciones ya capturadas por el docente.** Auditoría debe distinguir quién capturó vs. quién modificó.
2. **Docente ve únicamente la CURP del alumno** entre los datos personales sensibles; teléfono/email/fecha de nacimiento solo visibles para Directivo y Admin.
3. **Docente puede ver el promedio general del alumno en todas las materias**, no solo en la suya (marcado como revisable a futuro, no como decisión final).
4. **Se agrega el rol `admin`** como superset de `directivo`, con la única diferencia siendo gestión completa de cuentas de `Personal` (crear, editar rol, dar de baja — incluyendo cuentas de `directivo`).

---

## Pendiente para siguiente etapa

- Actualizar `Personal.rol` en el diccionario de datos y DDL a 3 valores.
- Confirmar si `admin` requiere alguna restricción especial (ej. no poder
  dar de baja su propia cuenta, para evitar quedar el sistema sin ningún
  admin activo) — recomendado agregar como regla de negocio en el service,
  no en RLS.