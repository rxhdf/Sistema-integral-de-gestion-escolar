# Priorización de interfaces por flujo — SIGE MVP

Agrupa las 32 interfaces de `docs/frontend/00-inventario-interfaces.md`
en los 5 flujos end-to-end del MVP. `SIGE_MVP_Brief_ClaudeCode.md` no
está en este repo (solo se le referencia desde
`docs/data_dictionary/mvp.md`); los 5 flujos usados aquí son los que
llegaron especificados en la solicitud, y coinciden con el alcance de
entidades ya fijado en el diccionario de datos, así que no hay
contradicción que resolver.

## Los 3 criterios

- **Bloqueo** — ¿esta pantalla es requisito de acceso/dato para que otra
  exista o tenga sentido? Se midió contra las FK reales de
  `app/domains/*/models.py`, no por intuición (ej. `Grupo_Asignatura`
  tiene `id_grupo`, `id_asignatura`, `id_periodo`, `id_docente` como FK
  `NOT NULL` — sin esas 4 pantallas construidas antes, el formulario de
  alta ni siquiera puede poblar sus selects).
- **Frecuencia** — uso diario/recurrente (docente, directivo) pesa más
  que uso de una sola vez o esporádico (setup institucional, alta de
  personal).
- **Congruencia** — pantallas del mismo dominio con el mismo patrón de
  UI (tabla de listado + formulario de alta + formulario de edición) se
  agrupan, aunque la de edición individualmente tenga poca urgencia —
  construirlas juntas reutiliza el mismo componente base.

Los 3 no siempre apuntan en la misma dirección. Donde chocan, se dice
explícitamente cuál ganó y por qué (ver nota al final sobre
`PUT /calificacion` y sobre `Plantel`).

---

## Flujo 1 — Setup institucional (`Plantel`, `Ciclo_Escolar`, `Periodo_Semestral`)

| Orden | Endpoint | Tipo | Criterio aplicado |
|---|---|---|---|
| 1 | `GET /ciclo-escolar` | Tabla de listado | **Bloqueo** — `Periodo_Semestral` necesita un `id_ciclo` existente para su selector; sin esta pantalla no se puede construir la de periodo. |
| 2 | `POST /ciclo-escolar` | Formulario de alta | **Bloqueo** — crea el `id_ciclo` raíz que periodo, y transitivamente grupo/grupo_asignatura, referencian. |
| 3 | `GET /periodo-semestral` | Tabla de listado | **Bloqueo** — `Grupo` y `Grupo_Asignatura` (Flujo 3) tienen `id_periodo` `NOT NULL`; esta pantalla es la fuente de ese selector. |
| 4 | `POST /periodo-semestral` | Formulario de alta | **Bloqueo** — crea el `id_periodo` raíz que bloquea todo lo académico corriente abajo. |
| 5 | `PUT /periodo-semestral/{id_periodo}` | Acción de edición (activar/desactivar) | **Bloqueo** — activar el periodo correcto es requisito operativo antes de que capturar calificaciones (Flujo 5) tenga sentido de negocio, aunque no sea una FK. |
| 6 | `GET /plantel` | Vista de detalle | **Congruencia** (par de `PUT /plantel`) — no bloquea nada (la fila se siembra por migración) y es la de menor frecuencia del flujo; va al final aunque nombre el flujo. |
| 7 | `PUT /plantel` | Formulario de edición | **Congruencia** — cierra el par con `GET /plantel`; misma justificación de baja prioridad. |

## Flujo 2 — Alta de personal + login

| Orden | Endpoint | Tipo | Criterio aplicado |
|---|---|---|---|
| 1 | `POST /auth/login` | Formulario de login | **Bloqueo** — máximo posible: ningún otro endpoint del sistema (de los 32) es accesible sin sesión. Va primero en el flujo y en el orden global. |
| 2 | `GET /personal/me` | Vista de detalle (perfil propio) | **Bloqueo** + **Frecuencia** — primera llamada autenticada real de cualquier sesión (resuelve rol para pintar el layout); se ejecuta en cada carga, no solo en alta. |
| 3 | `POST /personal` | Formulario de alta | **Bloqueo** — sin esto no existe más `Personal` que el sembrado inicialmente; bloquea que haya más docentes reales para asignar en `Grupo_Asignatura` (Flujo 3). |
| 4 | `GET /personal` | Tabla de listado | **Bloqueo** — requisito para que directivo/admin vean a quién editar. |
| 5 | `PUT /personal/{id_personal}` | Formulario de edición | **Congruencia** (cierra el trío con `GET`/`POST /personal`) — no bloquea nada corriente abajo; frecuencia baja (editar rol/dar de baja es esporádico). |

## Flujo 3 — Estructura académica (`Grupo`, `Asignatura`, `Grupo_Asignatura`)

| Orden | Endpoint | Tipo | Criterio aplicado |
|---|---|---|---|
| 1 | `GET /grupo` | Tabla de listado | **Bloqueo** — `Grupo_Asignatura` y `Alumno.inscribir` (Flujo 4) necesitan `id_grupo`. |
| 2 | `POST /grupo` | Formulario de alta | **Bloqueo** — crea el `id_grupo` que ambos consumen. |
| 3 | `GET /asignatura` | Tabla de listado | **Bloqueo** — `Grupo_Asignatura` necesita `id_asignatura`. |
| 4 | `POST /asignatura` | Formulario de alta | **Bloqueo** — crea el catálogo de materias, requisito de `Grupo_Asignatura`. |
| 5 | `GET /grupo-asignatura` | Tabla de listado | **Bloqueo** + **Frecuencia** — `Calificacion` (Flujo 5) tiene `id_grupo_asig` `NOT NULL`; además es la pantalla que un docente consulta a diario para saber "qué imparto". |
| 6 | `POST /grupo-asignatura` | Formulario de alta | **Bloqueo** — asigna docente+grupo+materia+periodo; sin esto no hay ningún `id_grupo_asig` que `Calificacion` pueda referenciar, es decir, bloquea por completo el Flujo 5. |
| 7 | `PUT /grupo/{id_grupo}` | Formulario de edición | **Congruencia** (cierra el trío de `Grupo`) — baja frecuencia. |
| 8 | `PUT /asignatura/{id_asignatura}` | Formulario de edición | **Congruencia** (cierra el trío de `Asignatura`) — baja frecuencia. |
| 9 | `PUT /grupo-asignatura/{id_grupo_asig}` | Formulario de edición | **Congruencia** (cierra el trío de `Grupo_Asignatura`) — baja frecuencia individual pese a que el par `GET`/`POST` tenga alta prioridad. |

## Flujo 4 — Alumnos y expedientes

| Orden | Endpoint | Tipo | Criterio aplicado |
|---|---|---|---|
| 1 | `GET /alumno` | Tabla de listado | **Bloqueo** + **Frecuencia** — `inscribir`, `Expediente_Academico` y `Calificacion` necesitan `id_alumno`; además es la pantalla base que docente/directivo usan a diario ("quiénes son mis alumnos"). |
| 2 | `POST /alumno` | Formulario de alta | **Bloqueo** — crea el `id_alumno` raíz del flujo. |
| 3 | `POST /alumno/{id_alumno}/inscribir` | Formulario/acción de inscripción | **Bloqueo** — `Alumno.id_grupo` es nullable hasta que se inscribe (`app/domains/alumnos/models.py`); sin esta pantalla el alumno nunca aparece en el `Grupo_Asignatura` correcto para que un docente le capture calificaciones. |
| 4 | `POST /expediente-academico` | Formulario de alta | **Bloqueo** — `fn_actualizar_promedio_actual` (invocada al capturar `Calificacion`, ver `app/domains/control_escolar/service.py`) necesita una fila de expediente ya existente para el alumno. |
| 5 | `GET /expediente-academico/{id_alumno}` | Vista de detalle | **Frecuencia** — docente/directivo la consultan seguido para ver `situacion_academica`/`promedio_actual`; no bloquea nada que `GET /alumno` no cubra ya, por eso queda después del alta. |
| 6 | `PUT /alumno/{id_alumno}` | Formulario de edición | **Congruencia** (cierra el trío de `Alumno`) — baja-media frecuencia (corrección de datos personales). |
| 7 | `PUT /expediente-academico/{id_alumno}` | Formulario de edición | **Congruencia** (cierra el par de `Expediente_Academico`) — baja frecuencia (`situacion_academica`/`escuela_procedencia` se editan poco). |

## Flujo 5 — Captura y consulta de calificaciones

| Orden | Endpoint | Tipo | Criterio aplicado |
|---|---|---|---|
| 1 | `GET /calificacion` | Tabla de listado | **Frecuencia** — uso diario de docente y directivo; además valida visualmente que el scope RLS (docente ve solo lo suyo) funciona antes de construir el formulario de captura sobre el mismo scope. |
| 2 | `POST /calificacion` | Formulario de captura | **Bloqueo** + **Frecuencia** — es el endpoint que produce el dato que todo lo demás en este flujo consulta/audita; uso diario durante periodos de captura. |
| 3 | `PUT /calificacion/{id_calificacion}` | Formulario de corrección | **Frecuencia** — las correcciones (ADR-004: directivo/admin corrigen lo capturado por docente) son recurrentes, no un evento único; ver nota al final sobre por qué esta rompe el patrón de "agrupar ediciones al final". |
| 4 | `GET /auditoria-calificacion` | Tabla de listado (solo lectura, append-only) | Ninguno de los tres la empuja arriba: no bloquea nada (derivado, read-only), frecuencia baja (solo supervisión ocasional de directivo/admin), y aunque comparte el patrón visual de "tabla de listado" con `GET /calificacion`, es la última construida del flujo. |

---

## Orden global de construcción (las 32, no solo por flujo)

| # | Endpoint | Flujo | Criterio dominante |
|---|---|---|---|
| 1 | `POST /auth/login` | 2 | Bloqueo — gate universal |
| 2 | `GET /personal/me` | 2 | Bloqueo — primera llamada autenticada de toda sesión |
| 3 | `GET /ciclo-escolar` | 1 | Bloqueo — selector de `Periodo_Semestral` |
| 4 | `POST /ciclo-escolar` | 1 | Bloqueo — crea `id_ciclo` raíz |
| 5 | `GET /periodo-semestral` | 1 | Bloqueo — selector de `Grupo`/`Grupo_Asignatura` |
| 6 | `POST /periodo-semestral` | 1 | Bloqueo — crea `id_periodo` raíz |
| 7 | `PUT /periodo-semestral/{id_periodo}` | 1 | Bloqueo — activar el periodo correcto |
| 8 | `POST /personal` | 2 | Bloqueo — habilita más docentes reales |
| 9 | `GET /personal` | 2 | Bloqueo — selector para editar |
| 10 | `GET /grupo` | 3 | Bloqueo — selector de `Grupo_Asignatura`/`inscribir` |
| 11 | `POST /grupo` | 3 | Bloqueo — crea `id_grupo` |
| 12 | `GET /asignatura` | 3 | Bloqueo — selector de `Grupo_Asignatura` |
| 13 | `POST /asignatura` | 3 | Bloqueo — crea `id_asignatura` |
| 14 | `GET /grupo-asignatura` | 3 | Bloqueo + Frecuencia |
| 15 | `POST /grupo-asignatura` | 3 | Bloqueo — habilita todo el Flujo 5 |
| 16 | `GET /alumno` | 4 | Bloqueo + Frecuencia |
| 17 | `POST /alumno` | 4 | Bloqueo — crea `id_alumno` |
| 18 | `POST /alumno/{id_alumno}/inscribir` | 4 | Bloqueo — matrícula en grupo |
| 19 | `POST /expediente-academico` | 4 | Bloqueo — requisito de `fn_actualizar_promedio_actual` |
| 20 | `GET /expediente-academico/{id_alumno}` | 4 | Frecuencia |
| 21 | `GET /calificacion` | 5 | Frecuencia |
| 22 | `POST /calificacion` | 5 | Bloqueo + Frecuencia — el producto central del MVP |
| 23 | `PUT /calificacion/{id_calificacion}` | 5 | Frecuencia (ver nota) |
| 24 | `PUT /personal/{id_personal}` | 2 | Congruencia |
| 25 | `PUT /grupo/{id_grupo}` | 3 | Congruencia |
| 26 | `PUT /asignatura/{id_asignatura}` | 3 | Congruencia |
| 27 | `PUT /grupo-asignatura/{id_grupo_asig}` | 3 | Congruencia |
| 28 | `PUT /alumno/{id_alumno}` | 4 | Congruencia |
| 29 | `PUT /expediente-academico/{id_alumno}` | 4 | Congruencia |
| 30 | `GET /plantel` | 1 | Ninguno de los 3 pesa (ver nota) |
| 31 | `PUT /plantel` | 1 | Ninguno de los 3 pesa (ver nota) |
| 32 | `GET /auditoria-calificacion` | 5 | Ninguno de los 3 pesa |

### Dos ajustes que rompen el agrupamiento obvio, documentados aquí

- **`PUT /calificacion` (#23) se adelanta sobre las demás pantallas de
  edición** (que quedan agrupadas en #24-29). Por Congruencia iría junto
  a `GET`/`POST /calificacion` de todos modos (ya está ahí), pero la
  razón real de que no caiga hasta el bloque de "ediciones de baja
  frecuencia" es que **Frecuencia le gana a Congruencia** aquí: corregir
  calificaciones (ADR-004) es una operación recurrente del Flujo 5, no
  esporádica como editar un `Grupo` o una `Asignatura`.
- **`Plantel` (#30-31), pese a nombrar el Flujo 1 y aparecer primero ahí,
  termina penúltimo en el orden global.** Ningún otro endpoint de los 32
  tiene una FK hacia `Plantel` fuera de la semilla inicial (`Personal` y
  `Alumno` sí tienen `id_plantel`, pero apuntan a la única fila que ya
  existe por migración, no a una que el usuario cree en la UI) — así que
  Bloqueo es nulo, y Frecuencia es la más baja de las 32 (edición
  institucional casi de evento único). `GET /auditoria-calificacion`
  (#32) cierra la lista por el mismo motivo: es un derivado read-only
  sin ninguna pantalla corriente abajo que dependa de ella.
