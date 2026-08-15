# SIGE — estado del proyecto

Orientación rápida para retomar sin releer todo `docs/` ni todo el código.
Este archivo es un índice + reglas, no una fuente de verdad — si algo aquí
contradice el código o un ADR, gana el ADR/código y hay que corregir esto.

## Fase actual

**Fase 0 (fundación) cerrada y confirmada.** Evidencia real, no simulada:
run verde en GitHub Actions (`fase0-gate`, repo
`rxhdf/Sistema-integral-de-gestion-escolar`, commit `27e2668` / `8f1e3e9`
en `main`) — ver `docs/validacion/fase-0-cierre.md` para el detalle
completo (los 4 puntos del gate con logs reales).

**Fase 2 (organizacional + personal + Auth JWT) cerrada y confirmada.**
Evidencia real: 39 tests pasando (RBAC + cadena JWT → SET → RLS) en
Postgres real, run verde en GitHub Actions (`fase0-gate`, commit
`e282134`, run `30967396658`) — ver
`docs/validacion/fase-02-organizacional-personal-auth.md` para el detalle
completo.

**Fase 3 (estructura académica: `Grupo`, `Asignatura`, `Grupo_Asignatura`)
cerrada y confirmada.** Evidencia real: 68 tests pasando (39 previos + 29
nuevos) en Postgres real, run verde en GitHub Actions (`fase0-gate`,
commit `50cd272`, run `31127657254`) — ver
`docs/validacion/fase-03-academico.md` para el detalle completo.

**Fase 4 (Alumnos y Expedientes: `Alumno`, `Expediente_Academico`)
cerrada y confirmada.** Evidencia real: 95 tests pasando (68 previos + 27
nuevos, incluyendo 2 de bypass directo de RLS) en Postgres real, local
(`docker-compose up --build`) — ver `docs/validacion/fase-04-alumnos.md`
para el detalle completo, incluyendo un gap de RLS encontrado y
corregido en `expediente_academico_select` (tenía `USING(true)`,
contradecía ADR-001). CI confirmado en verde: el commit de cierre de
esta fase (`5300b44`) tiene run propio,
[`31133057823`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/31133057823),
success — ver el cierre del outage de dispatch en
`docs/validacion/ci-dispatch-outage-2026-08-06.md`.

**Fase 5 (calificaciones y auditoría: `Calificacion`,
`Auditoria_Calificacion`) cerrada y confirmada.** Evidencia real: **135
tests pasando** contra Postgres real, local (`docker-compose up`) — ver
`docs/validacion/fase-05-calificaciones.md` para el cierre consolidado
(mismo formato que las fases anteriores), incluyendo: RLS auditada
explícitamente *antes* de construir nada (1 gap encontrado y corregido
de inmediato, `auditoria_calificacion_insert` con `WITH CHECK(true)`); 2
gaps adicionales encontrados solo al ejercer el flujo real como docente,
no visibles en el análisis estático (`RETURNING` vs. política SELECT de
auditoría; `promedio_actual` bloqueado por `expediente_academico_write`,
resuelto con `fn_actualizar_promedio_actual`, SECURITY DEFINER, mismo
patrón que ADR-007); la regla de "parciales disponibles" de ADR-005; el
403 limpio en `POST /calificacion` para `grupo_asignatura` ajeno; y la
verificación de que `Auditoria_Calificacion` es append-only a nivel de
API y de RLS para los 3 roles, incluido `admin`. El detalle
turno-por-turno de cómo se llegó ahí queda en
`docs/validacion/fase-05-control-escolar.md`. **CI confirmado en verde**:
[`31137042423`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/31137042423)
(commit `8d77d13`, HEAD actual) — 135 passed en el runner de GitHub,
idéntico al resultado local. Ver cierre completo del outage de dispatch
en `docs/validacion/ci-dispatch-outage-2026-08-06.md`.

**Con Fase 5 cerrada, todas las entidades del MVP (ADR-002) están
implementadas** (`Plantel`, `Ciclo_Escolar`, `Periodo_Semestral`,
`Personal`, `Grupo`, `Asignatura`, `Grupo_Asignatura`, `Alumno`,
`Expediente_Academico`, `Calificacion`, `Auditoria_Calificacion`). No hay
una "Fase 6" de backend planeada todavía.

**Frontend del MVP cerrado (31 de 32 fichas).** Las 5 flujos de
`docs/frontend/01-priorizacion-flujos.md` tienen página real en
`frontend/src/pages/`: listados, altas, acciones (inscribir, activar/
desactivar) y ediciones de las 11 entidades del MVP. Evidencia real:
158 tests de backend pasando (incluye 3 traducciones de 500→409 nuevas
en `PUT /grupo`, `PUT /grupo-asignatura`, `PUT /alumno`), `tsc`/`vite
build`/`oxlint` limpios, y verificación manual con los 3 roles reales
contra `docker-compose` (incluye el guard del único admin activo en
`PUT /personal` y la edición sin `{id}` de `Plantel`) — ver
`docs/validacion/frontend-mvp-cierre.md` para el detalle completo,
incluyendo un hallazgo documentado (no corregido, fuera de alcance) de
datos sueltos + falta de `ORDER BY` en `GET /plantel`. Única ficha
pendiente: **#32, `GET /auditoria-calificacion`** (read-only, sin nada
corriente abajo que dependa de ella).

Con backend y frontend del MVP completos, el siguiente paso es decisión
del usuario: cerrar la ficha #32, resolver el hallazgo del Punto 4 de
`frontend-mvp-cierre.md`, o pasar a otra capa (deploy, etc.).

**`Asistencia` (backend) — primera feature post-MVP, cerrada y
confirmada (ADR-008).** ADR-002 la excluía del alcance original; ADR-008
documenta por qué se agrega ahora sin reabrir el resto de entidades
excluidas (`Familia`, `Tutor`, `Expediente_Personal`/`Escolar`, que
siguen fuera). Diseño cerrado en `docs/data_dictionary/asistencia.md`:
registro por sesión (alumno x `grupo_asignatura` x fecha), captura en
lote con UPSERT (`POST /asistencia/lote`, corrige sin `409` a diferencia
de `Calificacion`), RLS con el mismo patrón que `calificacion_select`/
`insert`/`update` más anti-suplantación de `id_personal_registro`. RLS
validada con `sige_app` directo (10 casos de matriz) **antes** de
escribir FastAPI, mismo rigor que Fase 5. 170 tests pasando (158
previos + 12 nuevos de `tests/test_asistencia.py`), local
(`docker-compose`). **Decisión confirmada (2026-08-11): directivo/admin
NO corrigen asistencia** — el negocio no lo requiere; sin endpoint
`PUT`, `asistencia_update` (RLS) se deja como está sin ejercerse desde
la API (ver "Consecuencias" en ADR-008, actualizado).

**`Asistencia` (frontend) — cerrado.** 3 pantallas:
`AsistenciaCapturaPage` (`/asistencia/capturar`, docente únicamente —
selecciona su `grupo_asignatura`, precarga el estado ya capturado ese
día si existe, corrige vía el mismo submit/UPSERT), `AsistenciaListPage`
(`/asistencia`, vista diaria, los 3 roles), `AsistenciaResumenPage`
(`/alumno/:id/asistencia-resumen`, agregado por alumno, los 3 roles,
enlazada desde `AlumnoListPage`). Nav item "Asistencia" visible a los 3
roles (docente tiene R, mismo patrón que "Alumnos"/"Plantel").

**Bug real encontrado y corregido durante la construcción, con impacto
más allá de Asistencia:** `frontend/src/lib/useApiQuery.ts` no volvía a
poner `loading: true` al cambiar de `fetcher` (ej. un `useCallback` que
depende de un `id` de ruta o un `<select>`) — el estado se quedaba con
el `data`/`loading:false` de la consulta ANTERIOR mientras la nueva
seguía en vuelo. Cualquier página que decidiera "ya cargó" mirando solo
`loading` podía actuar sobre datos viejos. Corregido en el hook
compartido (afecta a las ~5 páginas con fetchers dinámicos, no solo
Asistencia). Además, `AsistenciaCapturaPage` tenía una condición de
carrera propia (un guard "ya inicialicé para esta combinación
grupo+fecha" que podía marcarse en un render intermedio con datos
todavía vacíos) — se resolvió rediseñando el precargado para que el
valor mostrado/enviado se **derive** en cada render
(`overrides[id] ?? servidor[id] ?? 'presente'`) en vez de "snapshotear"
una vez; eso elimina la clase entera de bug, no solo el síntoma
observado. Ver commit correspondiente para el detalle completo.

**`Reporte_Incidencia` — segunda feature post-MVP, cerrada y confirmada
(ADR-010).** Mismo patrón que `Asistencia` (ADR-008): entidad nueva
agregada después del MVP, sin reabrir el resto de entidades excluidas
por ADR-002. Diseño cerrado en
`docs/data_dictionary/reporte-incidencia.md`: cualquier docente activo
puede reportar una incidencia sobre **cualquier alumno del plantel**, no
solo los de su propio `grupo_asignatura` — desviación deliberada del
patrón de scope ya usado en `Calificacion`/`Asistencia`, documentada
explícitamente en ADR-010 (el negocio pidió que una incidencia de
conducta pueda reportarse aunque el docente no imparta clase a ese
alumno, ej. pasillo/receso — exigir `grupo_asignatura` bloquearía el
caso de uso real). Para sostener la búsqueda de alumno fuera de scope
sin ampliar `alumno_select`, se agregó `fn_alumno_buscar_docente`
(`SECURITY DEFINER`, mismo patrón acotado que `fn_login_lookup` de
ADR-007) expuesta vía `GET /alumno/buscar-plantel`. RLS validada con
`sige_app` directo **antes** de escribir FastAPI (7 casos de matriz, ver
`docs/validacion/reporte-incidencia.md`, Punto 1); tabla inmutable (sin
políticas `UPDATE`/`DELETE`, sin endpoints `PUT`/`DELETE`, reconfirmado
en vivo con `admin`: `405` contra la única ruta que existe,
`/reporte-incidencia`). Frontend: pantalla de captura para docente
(`/reporte-incidencia/capturar`, con buscador plantel-wide) y sección
"Incidencias" en el Perfil de Análisis de Alumno (directivo/admin,
ADR-009) mostrando fecha, descripción y nombre real del docente autor
(no un ID crudo). **186 tests pasando** (176 previos + 10 nuevos: 8 en
`tests/test_reporte_incidencia.py` + 2 en `tests/test_alumnos.py` para
`buscar-plantel`), y verificación manual end-to-end de los 3 roles
contra el stack completo (navegador real + `curl`) — ver
`docs/validacion/reporte-incidencia.md`, Punto 2, para el cierre
consolidado con evidencia real pegada.

## Qué leer para qué (no releer todo por defecto)

| Necesito... | Leer |
|---|---|
| Entidades, tipos de campo, nulabilidad, sensibilidad de datos | `docs/data_dictionary/mvp.md` |
| Quién puede hacer qué (CRUD por rol, scope, campos ocultos) | `docs/rbac/matriz-rbac-mvp.md` |
| Por qué el esquema/roles/RLS son como son — **leer antes de proponer cambios de arquitectura** | `docs/decisions/ADR-001.md` a `ADR-010.md` (ver resumen abajo) |
| El DDL real, ya validado en Postgres 16 (tablas, RLS, funciones helper) | `db/ddl_mvp.sql` |
| Cómo se traduce ese DDL a Alembic | No hay una sola migración que lo haga: `7460fa835be8_initial_schema_from_ddl_mvp.py` aplica un snapshot CONGELADO (`db/migrations_snapshots/ddl_mvp_at_7460fa835be8.sql`) para las 11 tablas iniciales del MVP; cada tabla/política/función agregada después (Asistencia, `fn_login_lookup`, Reporte_Incidencia, etc.) tiene su propia migración incremental en `app/db/migrations/versions/`. `db/ddl_mvp.sql` es la referencia legible del esquema completo ACTUAL — ninguna migración lo re-deriva completo, y editarlo no afecta ninguna base de datos por sí solo. |
| Cómo levantar todo local (roles, migración automática, /health) | `docker-compose.yml` + `docs/decisions/ADR-006.md` |
| Evidencia de que RLS funciona con el rol real de runtime | `docs/validacion/rls-test-log-sige_app.md` |
| Cierre y evidencia del gate de Fase 0 | `docs/validacion/fase-0-cierre.md` |
| Cierre y evidencia de Fase 2 (organizacional/personal/Auth) | `docs/validacion/fase-02-organizacional-personal-auth.md` |
| Cierre y evidencia de Fase 3 (académico: Grupo/Asignatura/Grupo_Asignatura) | `docs/validacion/fase-03-academico.md` |
| Cierre y evidencia de Fase 4 (Alumno/Expediente_Academico) + gap de RLS corregido | `docs/validacion/fase-04-alumnos.md` |
| Cierre consolidado y definitivo de Fase 5 (Calificacion/Auditoria_Calificacion) | `docs/validacion/fase-05-calificaciones.md` |
| Historial turno-por-turno de cómo se llegó al cierre de Fase 5 (gaps de RLS según se fueron encontrando) | `docs/validacion/fase-05-control-escolar.md` |
| Outage de dispatch de GitHub Actions del 2026-08-06 — RESUELTO, cierre con evidencia | `docs/validacion/ci-dispatch-outage-2026-08-06.md` |
| Cierre del frontend del MVP (32/32 fichas menos auditoría) + hallazgo de Plantel/ORDER BY | `docs/validacion/frontend-mvp-cierre.md` |
| Qué pantalla del frontend cubre cada endpoint, y por qué se priorizó en ese orden | `docs/frontend/01-priorizacion-flujos.md` |
| Diseño cerrado de Asistencia (campos, RBAC, endpoint de lote/UPSERT) | `docs/data_dictionary/asistencia.md` |
| Diseño cerrado de Reporte_Incidencia (campos, RBAC, scope sin `grupo_asignatura`, `fn_alumno_buscar_docente`) | `docs/data_dictionary/reporte-incidencia.md` |
| Cierre y evidencia de Reporte_Incidencia: RLS validada antes de FastAPI (Punto 1) + verificación manual de los 3 roles (Punto 2) | `docs/validacion/reporte-incidencia.md` |

### Resumen de 1 línea por ADR (no sustituye leerlos completos)

- **ADR-001**: `Expediente_Academico` es tabla separada de `Alumno` — permite RLS por tabla completa, no por columna.
- **ADR-002**: MVP limitado a `Expediente_Academico`; `Expediente_Personal`/`Escolar`, `Familia`, `Tutor`, etc. quedan fuera a propósito. `Asistencia` salió de esa lista en ADR-008 (post-MVP, agregada).
- **ADR-003**: roles colapsados en `Personal.rol` (`docente`/`directivo`/`admin`), no tablas separadas por rol.
- **ADR-004**: `directivo`/`admin` sí pueden corregir calificaciones ya capturadas por un docente (auditoría debe distinguir captura vs. corrección).
- **ADR-005**: `calificacion_final` y `promedio_actual` se calculan en el service de FastAPI, no en trigger ni vista de Postgres.
- **ADR-006**: separación de roles de conexión a Postgres (ver siguiente sección) — el más relevante para cualquier trabajo de infraestructura/backend.
- **ADR-007**: `fn_login_lookup` (`SECURITY DEFINER`) — excepción acotada a RLS de `Personal` para resolver el login, ya que antes de emitir el JWT no hay `SET app.current_rol`/`app.current_personal_id` que RLS pueda usar.
- **ADR-008**: `Asistencia` se agrega post-MVP (ADR-002 la excluía) — diseño cerrado, resto de entidades excluidas por ADR-002 siguen fuera de alcance.
- **ADR-009**: Perfil de Análisis de Alumno — reintroduce `municipio_origen`/`localidad_origen` en `Alumno` (excluidos de `AlumnoOutDocente`) y agrega `GET /alumno?search=`, sin ampliar el scope RLS existente.
- **ADR-010**: `Reporte_Incidencia` — `reporte_incidencia_insert` sin join a `grupo_asignatura` (cualquier docente activo reporta cualquier alumno del plantel, desviación deliberada del patrón de `Calificacion`/`Asistencia`); `fn_alumno_buscar_docente` (`SECURITY DEFINER`, mismo patrón que ADR-007) para sostener la búsqueda sin ampliar `alumno_select`.

## Roles de conexión a Postgres (ADR-006) — regla dura

Dos roles, nunca intercambiables:

- **`sige_migrator`**: owner de las tablas. Solo lo usa Alembic
  (`DATABASE_URL_MIGRATIONS`). Creado automáticamente por el entrypoint de
  Postgres vía `POSTGRES_USER` en `docker-compose.yml`.
- **`sige_app`**: rol de runtime. `NOSUPERUSER`, sin ownership, solo
  `SELECT/INSERT/UPDATE/DELETE` vía GRANT explícito (otorgado en la
  migración de Alembic + `ALTER DEFAULT PRIVILEGES` en
  `db/init/01_create_app_role.sh`). Es el **único** rol que debe usar
  `DATABASE_URL` en el backend (`app/core/config.py`).

**El backend en runtime NUNCA debe conectarse con `sige_migrator`.** Si lo
hace, RLS se bypassea en silencio (owner/superuser ignoran las políticas
RLS sin error) — ya se validó y documentó este comportamiento en
`docs/validacion/`. Cualquier script, endpoint, o servicio nuevo que
necesite tocar la BD usa `DATABASE_URL` (`sige_app`), nunca
`DATABASE_URL_MIGRATIONS`.

## Pendientes abiertos ahora mismo

- PENDIENTE CRÍTICO - marco legal de protección de datos: el proyecto se
  definió originalmente bajo LGPDPPSO (sujetos obligados, dado que el
  COBAO es entidad pública), documentado en SIGE_Contexto_Proyecto.md. En
  conversación posterior se mencionó "LFDPDD" (posible referencia a la ley
  de particulares) sin confirmación explícita de cuál aplica realmente.
  Esto afecta: avisos de privacidad, derechos ARCO, políticas de retención
  de datos, y cualquier documento legal que el sistema muestre a alumnos/
  tutores. NO cerrar el proyecto ni pasar a producción sin resolver esto
  con el área jurídica del COBAO o un especialista en protección de datos
  del sector público. Ver docs/decisions/ (agregar como futuro ADR una vez
  resuelto).
- Ninguno bloqueando — 135 tests pasando tanto local (Postgres real,
  ver `docs/validacion/fase-05-calificaciones.md`) como en CI de GitHub
  Actions, confirmado en verde sin discrepancias
  (`docs/validacion/ci-dispatch-outage-2026-08-06.md`, cerrado
  2026-08-07).
- `POST /calificacion` con `id_grupo_asig` ajeno ahora devuelve `403`
  limpio (`GrupoAsignaturaAjenoError`), no un `500` sin traducir.
  `PUT /calificacion/{id}` se mantiene en `404` (no `403`) para un
  docente atacando la calificación de otro — decisión explícita,
  consistente con la opacidad RLS ya usada en `alumno`.
- `auditoria_calificacion` confirmado append-only con el mismo rigor de
  Fase 4: sin endpoint `PUT`/`DELETE` (405), sin política RLS de
  `UPDATE`/`DELETE` (Postgres deniega por defecto — `0` filas afectadas,
  para cualquier rol, incluido `admin`, que no es superusuario/owner).
- Preguntas de negocio sin resolver: si `Grupo_Asignatura` admite 2
  docentes por materia/grupo/período (validar con plantel piloto — el
  `UNIQUE` actual en `db/ddl_mvp.sql` asume uno solo), y el umbral real de
  aprobado/reprobado en `Calificacion` (asumido `>=6`,
  `app/domains/control_escolar/service.py::UMBRAL_APROBADO`, sin
  confirmar con el negocio — ver `docs/data_dictionary/mvp.md` #3).
- Regla de "faltantes" en `calificacion_final` (ADR-005 la dejaba
  abierta): se promedia sobre los parciales **disponibles**, no exige
  los 3 — solo queda `NULL`/`pendiente` si ninguno se ha capturado.
  Revisable si el negocio prefiere exigir los 3 antes de dar un
  resultado.
- `PUT /plantel` implementado (2026-08-06): directivo/admin editan la
  única fila de `Plantel` (sin `{id}` en el path, no hay ambigüedad de
  cuál — mismo patrón que `PUT /periodo-semestral` y `PUT /personal`).
  `POST /plantel` sigue bloqueado a propósito (ver nota en
  `docs/rbac/matriz-rbac-mvp.md`), eso no cambió.
- Ficha #32 (`GET /auditoria-calificacion`) es la única pantalla del
  frontend del MVP que falta — read-only, sin bloqueo real, ver
  `docs/validacion/frontend-mvp-cierre.md`.
- Hallazgo sin corregir (2026-08-11, ver Punto 4 de
  `docs/validacion/frontend-mvp-cierre.md`): `get_plantel`/`list_plantel`
  (`app/domains/organizacional/repository.py`) no tienen `ORDER BY`, y la
  base de datos de desarrollo local tiene 2 filas de `Plantel` (`PL-01`,
  `PL-DEV`) y 4 de `Personal` sueltas de una sesión de pruebas manual
  anterior, ajenas a `db/seed_dev.py`. No afecta producción (nunca hubo
  más de 1 fila real) pero es dev-only cruft a limpiar y un `ORDER BY`
  a agregar si se quiere blindar el caso.
- `Asistencia` (ADR-008): confirmado con el negocio (2026-08-11) que
  directivo/admin NO corrigen asistencia — `POST /asistencia/lote`
  (`require_roles("docente")`) sigue siendo el único endpoint de
  escritura, sin `PUT /asistencia/{id}` planeado. `asistencia_update`
  (RLS) se deja como está aunque no se ejerza desde la API. **Frontend
  cerrado y commiteado** (2026-08-11): captura+corrección (docente) +
  lectura (los 3 roles), sin pantalla de corrección para directivo/admin
  (no aplica).
- `Perfil de Análisis de Alumno` (ADR-009, 2026-08-11): reintroduce
  `municipio_origen`/`localidad_origen` en `Alumno` (excluidos de
  `AlumnoOutDocente`, mismo criterio que fecha_nacimiento/email/
  telefono_personal). `GET /alumno?search=` agregado sobre el endpoint
  existente (nombre completo parcial o CURP exacta, sin cambio de
  scope). Pantalla nueva `PerfilAnalisisAlumnoPage.tsx` (directivo/admin
  exclusivo, con buscador propio en `/alumno/buscar`) compone en cliente
  `GET /alumno` + `GET /expediente-academico/{id}` + `GET /calificacion`
  + `GET /asistencia/resumen/{id}` — mismo patrón que "Mis grupos", sin
  endpoint agregador nuevo. Bloqueo de docente es un gate explícito en
  el cliente (no hay endpoint propio que lo rechace), verificado incluso
  para un alumno dentro del propio scope RLS del docente. 176 tests
  pasando en total (5 nuevos de search + exclusión de campos). Pendiente: sin
  formulario en `AlumnoCreatePage`/`AlumnoEditPage` para capturar los 2
  campos nuevos (existen en el schema, se fijan solo vía API por ahora).
  **Frontend cerrado y commiteado.**

## Regla explícita para cualquier cambio de esquema

Antes de generar cualquier tabla, política RLS, o cambio de esquema
nuevo: **consultar los ADRs existentes primero.** No duplicar una decisión
ya tomada (ej. no reinventar cómo se resuelve el rol de sesión — ya existen
`app_current_rol()` / `app_current_personal_id()` en `db/ddl_mvp.sql`) ni
contradecir un ADR sin señalarlo explícitamente y proponer uno nuevo que lo
reemplace. Un cambio de arquitectura que contradice un ADR sin decirlo es
un bug de proceso, no solo de código.
