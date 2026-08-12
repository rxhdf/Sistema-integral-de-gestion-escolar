# Cierre del frontend del MVP — 32/32 fichas

**Fecha:** 2026-08-11
**Estado:** Frontend del MVP completo. Las 32 fichas de
`docs/frontend/01-priorizacion-flujos.md` tienen página real en
`frontend/src/pages/` y ruta en `App.tsx`, salvo la ficha #32
(`GET /auditoria-calificacion`), explícitamente fuera de esta tanda de
cierre (ver "Qué queda fuera" abajo).

## Punto 1 — Qué se implementó en esta entrega

Última tanda de 8 fichas, construidas en el orden acordado (Perfil →
Personal → Grupo → Asignatura → Grupo_Asignatura → Alumno →
Expediente_Academico → Plantel):

| Ficha | Endpoint | Página |
|---|---|---|
| 2 | `GET /personal/me` | `PerfilPage.tsx` (`/perfil`) |
| 24 | `PUT /personal/{id}` | `PersonalEditPage.tsx` (`/personal/:id/editar`) |
| 25 | `PUT /grupo/{id}` | `GrupoEditPage.tsx` (`/grupo/:id/editar`) |
| 26 | `PUT /asignatura/{id}` | `AsignaturaEditPage.tsx` (`/asignatura/:id/editar`) |
| 27 | `PUT /grupo-asignatura/{id}` | `GrupoAsignaturaEditPage.tsx` (`/grupo-asignatura/:id/editar`) |
| 28 | `PUT /alumno/{id}` | `AlumnoEditPage.tsx` (`/alumno/:id/editar`) |
| 29 | `PUT /expediente-academico/{id_alumno}` | `ExpedienteAcademicoEditPage.tsx` (`/alumno/:id/expediente-academico/editar`) |
| 30-31 | `GET`/`PUT /plantel` | `PlantelPage.tsx` (`/plantel`, una sola pantalla para las dos fichas — única fila del MVP, sin `{id}`) |

Todas siguen el patrón ya establecido en Flujos 1-5: `useApiQuery` +
`DashboardShell` + `buildNavItems(rol, activeHref)`; ediciones sin
`GET`-por-id se resuelven buscando en el listado ya pedido por la
pantalla de listado correspondiente (mismo patrón que
`CalificacionCorrectPage`), excepto `Expediente_Academico` que sí tiene
`GET` por id.

`GET /personal/me` (ficha 2) se reordenó primero en esta tanda por
Congruencia, no en su posición global #2 — ver la nota trazada en
`docs/frontend/01-priorizacion-flujos.md` ("Dos ajustes que rompen el
agrupamiento obvio... GET /personal/me").

Entrada a "Mi perfil": el bloque de avatar+nombre en el header
(`DashboardShell.tsx`) ahora es un `<Link to="/perfil">`, compartido por
las 32 pantallas.

## Punto 2 — Backend: traducción de 409/422 extendida a 3 `PUT` más

Confirmado con curl antes de construir el frontend (mismo criterio de
las 5 correcciones previas): `update_grupo`, `update_grupo_asignatura` y
`update_alumno` no capturaban `IntegrityError` — a diferencia de sus
`create_*` homólogos (corregidos en Flujo 3/4), devolvían 500 crudo en
`PUT`:

```
PUT /grupo/{id}            nombre_grupo duplicado  -> 500 (antes) / 409 (después)
PUT /grupo-asignatura/{id} id_periodo duplicado     -> 500 (antes) / 409 (después)
PUT /alumno/{id}           matricula duplicada      -> 500 (antes) / 409 (después)
```

Corrección: mismo patrón `_translate_integrity_error` ya existente en
`app/domains/academico/service.py` y `app/domains/alumnos/service.py`,
extendido a los 3 `update_*`. Verificado con curl después del fix (los 3
casos dan 409 con mensaje claro) y con el caso feliz (un `PUT` válido
sigue devolviendo 200). Commit `4855ef6`.

## Punto 3 — Verificación con los 3 roles (evidencia real, `docker-compose`)

- **`GrupoEditPage`** (directivo): 409 real en pantalla
  ("Ya existe un grupo con ese nombre en ese plantel y periodo") al
  renombrar un grupo para colisionar con otro existente; caso feliz
  confirmado por separado.
- **`PersonalEditPage`** (admin) — matiz específico, guard del único
  admin activo: se dejó un solo admin activo (`admin@cobao.edu.mx`,
  demovido el otro admin de seed a docente vía curl) y se intentó
  cambiar su propio rol a docente desde el formulario — 409 real en
  pantalla: "No se puede dar de baja ni cambiar el rol del único admin
  activo" (`LastActiveAdminError`, ya existía desde antes de esta
  entrega). Estado restaurado después de la prueba.
- **`PlantelPage`** (directivo) — matiz específico, sin `{id}` en la
  ruta: edición confirmada en `/plantel` (sin id en la URL), payload
  guardado y reflejado en pantalla. Docente confirmado en modo
  solo-lectura (misma URL, sin formulario, `puedeEditar` en `false`).
- **Docente**: nav recortado a Dashboard/Plantel/Alumnos/Calificaciones
  (sin Personal/Grupos/Asignaturas/Asignaciones/Ciclo escolar/Periodo
  semestral); `PerfilPage` muestra su propio registro completo, de solo
  lectura; acceso directo por URL a `/grupo/1/editar` renderiza el
  formulario (mismo patrón ya usado en Flujo 3: no se bloquea por ruta,
  se bloquea en el submit) y el `submit` devuelve 403 con mensaje claro
  ("No tienes permiso para editar grupos.").

`npm run build` (tsc + vite) y `npm run lint` (oxlint) limpios en todo
momento durante la construcción.

## Punto 4 — Hallazgo (no corregido en esta entrega, fuera de alcance)

Al probar `PlantelPage` con distintos roles en la misma sesión de QA se
observó que la fila devuelta por `GET /plantel` cambiaba de orden entre
llamadas (unas veces `PL-01`, otras `PL-DEV`). Investigado:

- `app/domains/organizacional/repository.py::list_plantel`/`get_plantel`
  usan `select(Plantel)` sin `ORDER BY` — el orden de Postgres sin
  `ORDER BY` no está garantizado.
- La base de datos de desarrollo local tiene **2 filas** en `plantel`
  (`id=1` "PL-01", `id=2` "PL-DEV") y 4 filas de `personal` con
  `id_plantel=1` que no vienen de `db/seed_dev.py` (que solo crea
  `PL-DEV`) — son datos sueltos de una sesión de pruebas manual anterior
  (fecha estimada 2026-08-06, cuando se implementó `PUT /plantel` por
  primera vez, según `CLAUDE.md`).
- El MVP asume una sola fila de `Plantel` por convención de proceso (sin
  `POST /plantel` expuesto), no por constraint de base de datos — nada
  impide que existan 2 filas si se insertan manualmente, como pasó aquí.

**No se corrigió en esta entrega** (fuera del alcance de las 8 fichas
pedidas, y la fila de datos sueltos es local, no toca `git` ni
producción). Queda anotado para quien resuelva el pendiente: (a) limpiar
la fila `id=1` y los 4 `Personal` sueltos de la base de datos local, y
(b) considerar agregar `ORDER BY id_plantel LIMIT 1` en
`get_plantel`/`list_plantel`, o un constraint que impida una segunda fila,
si se quiere blindar el caso contra manipulación manual futura.

## Punto 5 — Verificación completa

**158 passed** contra Postgres real, local (`docker-compose up`), antes
y después del fix de esta entrega — sin regresiones:

```
158 passed, 3 warnings in ~300s
```

## Qué queda fuera de este cierre (a propósito)

- **Ficha #32, `GET /auditoria-calificacion`**: no se nombró como parte
  de esta tanda (las 9 fichas acordadas fueron #2 y #24-31). Es la
  última ficha pendiente de las 32 — read-only, derivada, sin ninguna
  pantalla corriente abajo que dependa de ella (mismo razonamiento que
  ya tenía en `01-priorizacion-flujos.md`).
- **Hallazgo del Punto 4** (filas sueltas de `Plantel`/`Personal` en dev,
  falta de `ORDER BY`): documentado, no corregido — ver ese punto.
- **Deploy**: no forma parte de este cierre. El frontend del MVP está
  completo en código y verificado localmente; no se ha desplegado a
  ningún ambiente.

## Conclusión

31 de las 32 fichas del MVP tienen pantalla real, verificada con los 3
roles reales contra backend real. Los 3 `PUT` que aún devolvían 500 en
colisión (`Grupo`, `Grupo_Asignatura`, `Alumno`) ya traducen a 409, con
el mismo patrón usado en las 5 correcciones anteriores. **Frontend del
MVP formalmente cerrado**, con un pendiente explícito (ficha #32) y un
hallazgo documentado (Punto 4) para una iteración futura.
