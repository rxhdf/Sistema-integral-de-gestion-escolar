# Especificación de contenido — 32 interfaces del SIGE MVP

Una ficha por interfaz, en el orden global de
`docs/frontend/01-priorizacion-flujos.md`. Cada dato viene del código
real (`app/domains/*/schemas.py`, `router.py`, `service.py`,
`models.py`), no de memoria. Cero diseño visual — colores, tipografía y
layout son la Capa 4, siguiente paso después de este documento.

Roles abreviados: `D` = docente, `X` = directivo, `A` = admin.

---

## Baseline de accesibilidad (aplica a las 32 — cada ficha solo lista lo adicional)

- **Teclado:** toda la interfaz es operable sin mouse — `Tab`/`Shift+Tab`
  recorre los controles en orden lógico, `Enter`/`Espacio` activa
  botones, `Esc` cierra modales/formularios superpuestos. Foco visible
  en todo momento (nunca `outline: none` sin reemplazo).
- **Formularios:** cada campo tiene `<label>` asociado
  (`for`/`aria-labelledby`), no solo placeholder. Errores de validación
  se asocian al campo vía `aria-describedby` y se anuncian por lector de
  pantalla (`aria-live="polite"` como piso).
- **Touch targets:** mínimo 24×24px CSS (WCAG 2.2 AA, 2.5.8) en
  cualquier control interactivo de las 32 pantallas. Las 3 pantallas de
  captura/corrección de calificación (fichas #21, #22, #23) usan un piso
  más alto — ver su ficha.
- **Estructura:** un `<h1>` por pantalla, landmarks (`<main>`, `<nav>`)
  correctos, tablas de listado con `<th scope="col">` real (no `<div>`
  con estilos de tabla).

---

## Nota transversal: constraints de Postgres no traducidas a 4xx

Varios `POST`/`PUT` pueden violar un `UNIQUE`/`CHECK` de
`db/ddl_mvp.sql` que el service correspondiente **no captura**
explícitamente (a diferencia de `DocenteInvalidoError`,
`GrupoAsignaturaAjenoError` o `LastActiveAdminError`, que sí se
traducen a 400/403/409 limpios). Sin captura, SQLAlchemy propaga
`IntegrityError` y FastAPI responde **500** genérico, sin mensaje
accionable para el usuario. Cada ficha afectada cita el constraint
exacto; el frontend debe tratarlo como un 500 más (mensaje genérico de
"algo salió mal", no un error de validación de campo), no inventarle un
422 que el backend no produce.

---

### 1. `POST /auth/login` — Login

- **Rol(es):** público (sin sesión previa).
- **Datos que muestra:** ninguno de entrada — es la puerta de entrada.
  Al éxito, `TokenResponse { access_token, token_type }`; el frontend
  guarda el token y redirige, no pinta estos campos en pantalla.
- **Acciones disponibles:** enviar `email_institucional` + `password`
  (`LoginRequest`).
- **Estados:**
  - Vacío: formulario recién cargado, ambos campos en blanco.
  - Carga: botón deshabilitado mientras espera respuesta (evita doble
    submit).
  - Error: `401` credenciales inválidas — mismo mensaje genérico para
    email inexistente, password incorrecta, **o personal dado de baja**
    (`fn_login_lookup` ya filtra `estatus='activo'`, ADR-007 — no se
    distingue para no revelar si un email existe o no). `422` payload
    mal formado (falta un campo). `500` fallo inesperado.
- **Accesibilidad (delta):** el error 401 se anuncia con
  `aria-live="assertive"` (no `polite`) — es un fallo bloqueante que el
  usuario no puede perder. Campos con `autocomplete="username"` /
  `autocomplete="current-password"` para gestores de contraseñas y
  lectores de pantalla.

### 2. `GET /personal/me` — Mi perfil

- **Rol(es):** D, X, A (cada quien su propio registro).
- **Datos que muestra:** `PersonalOutSelf` (= `PersonalOut`):
  `id_personal`, `id_plantel`, `curp`, `nombre`, `apellido_paterno`,
  `apellido_materno`, `email_institucional`, `rol`, `telefono`,
  `fecha_ingreso`, `estatus`. `password_hash` nunca se expone (matriz
  RBAC, ningún rol la ve).
- **Acciones disponibles:** solo lectura (`R`) — la edición del propio
  registro no existe aquí; solo `A` puede editar vía ficha #24, y no
  necesariamente el suyo propio (ver guard del único admin activo en
  #24).
- **Estados:**
  - Vacío: no aplica en operación normal (login exitoso garantiza que
    la fila existe).
  - Carga: skeleton de los campos mientras responde.
  - Error: `401` token faltante/inválido/expirado. `404` registro no
    encontrado (caso límite — no debería ocurrir con un JWT válido,
    pero el código lo contempla). `500` fallo inesperado.
- **Accesibilidad (delta):** ninguna adicional al baseline.

### 3. `GET /ciclo-escolar` — Listado de ciclos escolares

- **Rol(es):** D, X, A (lectura); botón de alta (→ ficha #4) visible
  solo para X, A.
- **Datos que muestra:** `list[CicloEscolarOut]`: `id_ciclo`, `nombre`,
  `fecha_inicio`, `fecha_fin`, `activo`.
- **Acciones disponibles:** D — solo consultar. X, A — consultar y
  navegar al alta. **Nota:** la matriz RBAC otorga `U` sobre
  `Ciclo_Escolar` a X/A, pero no existe `PUT /ciclo-escolar` en el
  router — no hay acción de edición que ofrecer desde esta tabla
  todavía (mismo tipo de brecha que tenía `Plantel` antes de esta
  fase).
- **Estados:**
  - Vacío: plantel recién sembrado sin ningún ciclo creado (`[]`).
  - Carga: skeleton de filas.
  - Error: `401`. `500` fallo inesperado.
- **Accesibilidad (delta):** ninguna adicional.

### 4. `POST /ciclo-escolar` — Alta de ciclo escolar

- **Rol(es):** X, A (`require_roles("directivo", "admin")`).
- **Datos que muestra:** formulario de entrada `CicloEscolarCreate`:
  `nombre`, `fecha_inicio`, `fecha_fin`, `activo` (default `false`). Al
  éxito devuelve `CicloEscolarOut` (agrega `id_ciclo`).
- **Acciones disponibles:** crear (`C`). D nunca llega a esta pantalla.
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón "Guardar" deshabilitado durante el POST.
  - Error: `401`. `403` (D intentó acceder). `422` validación de
    Pydantic (fechas mal formadas, `nombre` excede 20 caracteres).
    `500` — incluye violaciones no traducidas de `chk_ciclo_fechas`
    (`fecha_fin <= fecha_inicio`), `nombre` UNIQUE, o
    `uq_ciclo_escolar_activo` si se manda `activo: true` habiendo ya
    otro ciclo activo (ver Nota transversal).
- **Accesibilidad (delta):** el resultado del submit (éxito o error) se
  anuncia por `aria-live="polite"`.

### 5. `GET /periodo-semestral` — Listado de periodos semestrales

- **Rol(es):** D, X, A (lectura); alta (→ ficha #6) y activar/desactivar
  (→ ficha #7) visibles solo para X, A.
- **Datos que muestra:** `list[PeriodoSemestralOut]`: `id_periodo`,
  `id_ciclo`, `clave_periodo`, `numero_periodo` (1 o 2),
  `fecha_inicio`, `fecha_fin`, `activo`.
- **Acciones disponibles:** D — solo consultar. X, A — consultar,
  navegar al alta, y (por fila) activar/desactivar.
- **Estados:**
  - Vacío: ciclo existe pero sin periodos creados (`[]`).
  - Carga: skeleton de filas.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 6. `POST /periodo-semestral` — Alta de periodo semestral

- **Rol(es):** X, A.
- **Datos que muestra:** formulario `PeriodoSemestralCreate`:
  `id_ciclo` (selector poblado desde ficha #3), `clave_periodo`,
  `numero_periodo` (1|2), `fecha_inicio`, `fecha_fin`, `activo`
  (default `false`). Al éxito devuelve `PeriodoSemestralOut` (agrega
  `id_periodo`).
- **Acciones disponibles:** crear (`C`).
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `422` (tipos/formato, `numero_periodo` fuera
    de `{1,2}`). `500` — `clave_periodo` UNIQUE,
    `uq_periodo_ciclo_numero` (ya existe ese número de periodo para ese
    ciclo), `chk_periodo_fechas`, o `uq_periodo_semestral_activo` si se
    manda `activo: true` con otro ya activo (ver Nota transversal —
    a diferencia de la ficha #7, aquí **no** hay lógica que desactive
    el otro automáticamente).
- **Accesibilidad (delta):** resultado del submit por
  `aria-live="polite"`.

### 7. `PUT /periodo-semestral/{id_periodo}` — Activar/desactivar periodo

- **Rol(es):** X, A.
- **Datos que muestra:** estado actual de `activo` (toggle), en el
  contexto de la fila de la tabla #5 (no un formulario aparte con más
  campos — `PeriodoSemestralUpdate` solo tiene `activo`).
- **Acciones disponibles:** editar (`U`) — únicamente activar o
  desactivar. `id_ciclo`, `clave_periodo`, `fecha_inicio`, `fecha_fin`
  no son editables aquí (fuera de alcance a propósito, ver docstring de
  `PeriodoSemestralUpdate`).
- **Estados:**
  - Vacío: no aplica — siempre parte de una fila existente.
  - Carga: toggle deshabilitado mientras responde.
  - Error: `401`. `403`. `404` `id_periodo` no encontrado. `422`
    (`activo` no es booleano). Sin riesgo de 500 por constraint: activar
    uno desactiva el otro activo en la misma transacción
    (`set_periodo_semestral_activo`, `repository.py`).
- **Accesibilidad (delta):** el cambio de estado se anuncia por
  `aria-live="polite"` ("Periodo 2026A activado").

### 8. `POST /personal` — Alta de personal

- **Rol(es):** A únicamente (`require_roles("admin")` — ni directivo).
- **Datos que muestra:** formulario `PersonalCreate`: `id_plantel`,
  `curp`, `nombre`, `apellido_paterno`, `apellido_materno`,
  `email_institucional`, `rol` (`docente`\|`directivo`\|`admin`),
  `telefono`, `fecha_ingreso`, `password` (mín. 8 caracteres, se hashea
  en el service, nunca se persiste en claro). Al éxito devuelve
  `PersonalOut` (sin `password_hash`).
- **Acciones disponibles:** crear (`C`). D y X ven `403` si intentan
  llegar aquí.
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403` (D o X). `422` (`curp` no mide 18, `password` <
    8 caracteres). `500` — `curp` UNIQUE o `email_institucional` UNIQUE
    ya registrados (ver Nota transversal).
- **Accesibilidad (delta):** campo `password` con
  `autocomplete="new-password"`; resultado del submit por
  `aria-live="polite"`.

### 9. `GET /personal` — Listado de personal del plantel

- **Rol(es):** X, A (`require_roles("directivo", "admin")` — D no
  llega, usa la ficha #2 para su propio registro).
- **Datos que muestra:** `list[PersonalOut]`: mismos campos que la
  ficha #2, para todo el plantel.
- **Acciones disponibles:** X — solo consultar (Nivel 1: "sin
  crear/editar/dar de baja"). A — consultar y navegar a edición (→
  ficha #24) por fila.
- **Estados:**
  - Vacío: defensivo únicamente — en la práctica siempre hay al menos 1
    admin sembrado.
  - Carga: skeleton de filas.
  - Error: `401`. `403` (D). `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 10. `GET /grupo` — Listado de grupos

- **Rol(es):** D, X, A (lectura); alta (→ ficha #11) visible solo para
  X, A.
- **Datos que muestra:** `list[GrupoOut]`: `id_grupo`, `id_plantel`,
  `id_periodo`, `semestre` (1-6), `nombre_grupo`, `capacidad_maxima`
  (opcional).
- **Acciones disponibles:** D — solo consultar. X, A — consultar y
  navegar al alta.
- **Estados:**
  - Vacío: periodo activo sin grupos creados todavía.
  - Carga: skeleton de filas.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 11. `POST /grupo` — Alta de grupo

- **Rol(es):** X, A.
- **Datos que muestra:** formulario `GrupoCreate`: `id_plantel`,
  `id_periodo` (selector poblado desde ficha #5), `semestre` (1-6),
  `nombre_grupo`, `capacidad_maxima` (opcional). Al éxito devuelve
  `GrupoOut` (agrega `id_grupo`).
- **Acciones disponibles:** crear (`C`).
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `422` (`semestre` fuera de 1-6 — ya bloqueado
    por el `Literal` de Pydantic antes de tocar la BD). `500` —
    `uq_grupo_nombre_periodo` (ya existe ese `nombre_grupo` en ese
    `id_plantel`+`id_periodo`, ver Nota transversal).
- **Accesibilidad (delta):** resultado del submit por
  `aria-live="polite"`.

### 12. `GET /asignatura` — Listado de asignaturas

- **Rol(es):** D, X, A (lectura); alta (→ ficha #13) visible solo para
  X, A.
- **Datos que muestra:** `list[AsignaturaOut]`: `id_asignatura`,
  `clave_asignatura`, `nombre`, `semestre` (1-6), `activa`.
- **Acciones disponibles:** D — solo consultar. X, A — consultar y
  navegar al alta.
- **Estados:**
  - Vacío: catálogo de materias sin capturar todavía.
  - Carga: skeleton de filas.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 13. `POST /asignatura` — Alta de asignatura

- **Rol(es):** X, A.
- **Datos que muestra:** formulario `AsignaturaCreate`:
  `clave_asignatura`, `nombre`, `semestre` (1-6), `activa` (default
  `true`). Al éxito devuelve `AsignaturaOut` (agrega `id_asignatura`).
- **Acciones disponibles:** crear (`C`).
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `422`. `500` — `clave_asignatura` UNIQUE (ver
    Nota transversal).
- **Accesibilidad (delta):** resultado del submit por
  `aria-live="polite"`.

### 14. `GET /grupo-asignatura` — Listado de asignaciones docente-grupo-materia

- **Rol(es):** D (solo las suyas, filtrado por RLS — `id_docente =
  current_user_id`), X, A (todas las del plantel).
- **Datos que muestra:** `list[GrupoAsignaturaOut]`: `id_grupo_asig`,
  `id_grupo`, `id_asignatura`, `id_docente`, `id_periodo`.
- **Acciones disponibles:** D — solo consultar sus propias
  asignaciones (esta pantalla es cómo un docente sabe "qué imparto").
  X, A — consultar todas y navegar al alta. **Nota:** la matriz RBAC
  otorga `D` (delete) sobre `Grupo_Asignatura` a X/A, pero no existe
  `DELETE /grupo-asignatura` en el router — no hay acción de eliminar
  que ofrecer, solo editar (→ ficha #27).
- **Estados:**
  - Vacío: (a) docente sin materias asignadas este periodo — es su
    realidad legítima, no un error; mensaje distinto al de "cargando".
    (b) X/A cuando el plantel no ha creado ninguna asignación todavía.
  - Carga: skeleton de filas.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 15. `POST /grupo-asignatura` — Asignar docente a grupo + materia

- **Rol(es):** X, A.
- **Datos que muestra:** formulario `GrupoAsignaturaCreate`: `id_grupo`
  (selector desde #10), `id_asignatura` (selector desde #12),
  `id_docente` (selector desde #9, filtrado a `rol='docente'` en el
  frontend aunque el backend valida esto vía trigger, no en Python),
  `id_periodo` (selector desde #5). Al éxito devuelve
  `GrupoAsignaturaOut` (agrega `id_grupo_asig`).
- **Acciones disponibles:** crear (`C`).
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `400` — `id_docente` no referencia a un
    `Personal` con `rol='docente'` (`DocenteInvalidoError`, validado por
    el trigger `fn_valida_rol_docente`, mensaje ya traducido y claro).
    `422`. `500` — `uq_grupo_asignatura_periodo` (esa combinación
    grupo+materia+periodo ya existe, ver Nota transversal).
- **Accesibilidad (delta):** resultado del submit por
  `aria-live="polite"`; el error `400` (docente inválido) también, ya
  que es una regla de negocio y no un typo de formato.

### 16. `GET /alumno` — Listado de alumnos

- **Rol(es):** D (alumnos de sus `Grupo_Asignatura` activas), X, A
  (todo el plantel). Alta (→ ficha #17) visible solo para X, A.
- **Datos que muestra:** payload distinto según rol —
  `response_model=None` en el router elige el schema en tiempo de
  ejecución:
  - D ve `AlumnoOutDocente`: `id_alumno`, `id_plantel`, `id_grupo`,
    `matricula`, `curp`, `nombre`, `apellido_paterno`,
    `apellido_materno`, `sexo`, `estatus`, `fecha_inscripcion`,
    `fecha_baja`.
  - X, A ven `AlumnoOutDirectivo` (extiende la de docente):
    **+ `fecha_nacimiento`, `email`, `telefono_personal`** — estos 3
    campos nunca llegan al payload de un docente, el filtrado ocurre en
    el backend, no es solo ocultamiento visual.
- **Acciones disponibles:** D — solo consultar (campos limitados). X, A
  — consultar (todos los campos) y navegar al alta.
- **Estados:**
  - Vacío: grupo/plantel sin alumnos inscritos todavía.
  - Carga: skeleton de filas.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** el frontend debe renderizar exactamente los
  campos que el backend envía para el rol activo — no debe haber una
  columna "fecha de nacimiento" en el DOM y oculta por CSS para
  docente; eso rompería el punto del filtrado en backend frente a
  lectores de pantalla / DevTools.

### 17. `POST /alumno` — Alta de alumno

- **Rol(es):** X, A.
- **Datos que muestra:** formulario `AlumnoCreate`: `id_plantel`,
  `id_grupo` (opcional — se puede dar de alta sin inscribir todavía),
  `matricula`, `curp`, `nombre`, `apellido_paterno`,
  `apellido_materno`, `fecha_nacimiento`, `sexo`, `email`,
  `telefono_personal`, `fecha_inscripcion`. Al éxito devuelve
  `AlumnoOutDirectivo` (fijo — solo X/A llegan aquí).
- **Acciones disponibles:** crear (`C`).
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `422` (`curp` no mide 18). `500` —
    `matricula` UNIQUE o `curp` UNIQUE (ver Nota transversal).
- **Accesibilidad (delta):** resultado del submit por
  `aria-live="polite"`.

### 18. `POST /alumno/{id_alumno}/inscribir` — Inscribir alumno a grupo

- **Rol(es):** X, A.
- **Datos que muestra:** formulario mínimo `AlumnoInscribir`:
  `id_grupo` (selector desde #10). Al éxito devuelve
  `AlumnoOutDirectivo` actualizado.
- **Acciones disponibles:** acción de inscripción (`U` sobre
  `Alumno.id_grupo`, que es nullable hasta este punto —
  `app/domains/alumnos/models.py`).
- **Estados:**
  - Vacío: no aplica — parte de un alumno ya existente.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `404` `id_alumno` no encontrado. `422`
    (`id_grupo` no es entero). `500` (poco probable — `id_grupo`
    inexistente rompe la FK y también cae aquí sin traducir).
- **Accesibilidad (delta):** el resultado se anuncia con
  `aria-live="assertive"` — mueve al alumno de grupo y afecta a qué
  `Grupo_Asignatura` (y por tanto qué docente) queda ligado, no es un
  cambio de bajo impacto.

### 19. `POST /expediente-academico` — Alta de expediente académico

- **Rol(es):** X, A.
- **Datos que muestra:** formulario `ExpedienteAcademicoCreate`:
  `id_alumno`, `escuela_procedencia` (opcional),
  `promedio_secundaria` (opcional), `promedio_actual` (opcional),
  `situacion_academica` (`regular`\|`irregular`\|`condicionado`,
  default `regular`). Al éxito devuelve `ExpedienteAcademicoOut`
  (agrega `id_exp_academico`).
- **Acciones disponibles:** crear (`C`).
- **Estados:**
  - Vacío: formulario en blanco.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403`. `422`. `500` — `id_alumno` UNIQUE (relación
    1:1 con `Alumno`; segundo expediente para el mismo alumno, ver Nota
    transversal).
- **Accesibilidad (delta):** resultado del submit por
  `aria-live="polite"`.

### 20. `GET /expediente-academico/{id_alumno}` — Detalle de expediente académico

- **Rol(es):** D (solo de alumnos en algún grupo donde tiene
  `Grupo_Asignatura` activa), X, A (todo el plantel).
- **Datos que muestra:** `ExpedienteAcademicoOut`: `id_exp_academico`,
  `id_alumno`, `escuela_procedencia`, `promedio_secundaria`,
  `promedio_actual`, `situacion_academica`. **Sin ocultamiento de
  columnas por rol** — matriz RBAC Nivel 3 confirma que un docente ve
  el promedio general del alumno en todas las materias, no solo la
  suya (nota: marcado ahí como revisable a futuro, no decisión final).
- **Acciones disponibles:** solo lectura (`R`) — la edición vive en la
  ficha #29.
- **Estados:**
  - Vacío: campos opcionales sin capturar (`escuela_procedencia`,
    `promedio_secundaria`, `promedio_actual` en `null`) — el expediente
    existe pero está incompleto; distinto del estado de error.
  - Carga: skeleton de campos.
  - Error: `401`. `404` — cubre tanto "no existe" como "existe pero
    fuera del scope RLS del docente" (mismo patrón de opacidad ya usado
    en `alumno`, no se distingue para no filtrar existencia). `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 21. `GET /calificacion` — Listado de calificaciones

- **Rol(es):** D (solo de sus `Grupo_Asignatura`, vía RLS), X, A (todo
  el plantel).
- **Datos que muestra:** `list[CalificacionOut]`: `id_calificacion`,
  `id_alumno`, `id_grupo_asig`, `parcial_1`, `parcial_2`, `parcial_3`
  (cada uno nullable — puede no estar capturado), `calificacion_final`
  (nullable — `null` mientras ningún parcial se ha capturado, ADR-005),
  `tipo_evaluacion` (`ordinaria`\|`extraordinaria`), `estatus`
  (`aprobado`\|`reprobado`\|`pendiente`, umbral `>=6`,
  `UMBRAL_APROBADO` en `service.py` — sin confirmar con negocio, ver
  `CLAUDE.md`), `fecha_captura`.
- **Acciones disponibles:** D — consultar y navegar a captura (→ ficha
  #22) o corrección de lo suyo (→ ficha #23). X, A — consultar todo el
  plantel y navegar a corrección (→ ficha #23, sin captura — X/A no
  tienen `C` sobre `Calificacion`).
- **Estados:**
  - Vacío: (a) docente sin capturas todavía en su grupo_asignatura —
    su realidad legítima al inicio de un periodo. (b) X/A cuando el
    plantel entero no ha capturado nada ese periodo.
  - Carga: skeleton de filas.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** **touch targets ≥44×44px CSS** (piso más
  alto que el baseline) en la fila que lleva a captura/corrección —
  esta tabla es el punto de entrada al flujo que un docente usa de pie,
  con prisa, en salón de clase.

### 22. `POST /calificacion` — Captura de calificación

- **Rol(es):** D únicamente (`require_roles("docente")` — X/A no tienen
  `C`, solo `R,U`, ADR-004).
- **Datos que muestra:** formulario `CalificacionCreate`: `id_alumno`
  (selector, alumnos del grupo de ese `id_grupo_asig`), `id_grupo_asig`
  (preseleccionado desde el contexto — normalmente se llega aquí desde
  la ficha #21 o #14, no eligiendo a mano), `parcial_1`, `parcial_2`,
  `parcial_3` (cada uno opcional, `0 <= valor <= 10`;
  `calificacion_final` se calcula en el backend sobre los parciales
  **disponibles**, no exige los 3, ADR-005), `tipo_evaluacion`
  (`ordinaria`\|`extraordinaria`, default `ordinaria`). Al éxito
  devuelve `CalificacionOut` completo (incluye `calificacion_final` y
  `estatus` ya calculados).
- **Acciones disponibles:** crear (`C`) — captura parcial válida (un
  solo parcial es suficiente para guardar).
- **Estados:**
  - Vacío: formulario en blanco, los 3 parciales en `null`,
    `tipo_evaluacion="ordinaria"` por defecto.
  - Carga: botón deshabilitado durante el POST.
  - Error: `401`. `403` — incluye tanto "no soy docente" como
    `id_grupo_asig` ajeno a otro docente
    (`GrupoAsignaturaAjenoError`, mensaje ya traducido, no un 500 crudo
    — cierre explícito de Fase 5). `422` (parcial fuera de `[0,10]`).
    `500` — `uq_calificacion_alumno_grupo_asig`: ya existe una
    calificación para ese alumno+grupo_asignatura (ver Nota
    transversal); el frontend debería evitar este caso deshabilitando
    "Capturar" y ofreciendo "Corregir" (ficha #23) cuando ya existe
    fila para ese alumno.
- **Accesibilidad (delta):** **touch targets ≥44×44px CSS** en los 3
  campos de parcial y el botón "Guardar" — captura real en salón de
  clase, con el docente de pie y posible imprecisión al tocar. El
  resultado del submit se anuncia con `aria-live="assertive"` — afecta
  la calificación oficial de un alumno, no es un cambio de bajo
  impacto.

### 23. `PUT /calificacion/{id_calificacion}` — Corrección de calificación

- **Rol(es):** D (solo de sus `Grupo_Asignatura`), X, A (todo el
  plantel — ADR-004: sí pueden corregir lo capturado por un docente).
- **Datos que muestra:** estado inicial = `parcial_1`, `parcial_2`,
  `parcial_3`, `tipo_evaluacion` actuales (pueden tener parciales en
  `null` si no se han capturado los 3). Formulario `CalificacionUpdate`
  edita esos mismos 4 campos. Al éxito devuelve `CalificacionOut`
  recalculado (`calificacion_final`/`estatus` se recalculan en el
  service).
- **Acciones disponibles:** editar (`U`). Cada corrección genera una
  fila en `Auditoria_Calificacion` con `accion='correccion'`
  (`chk_auditoria_accion`), distinta de `accion='captura'` — visible
  en la ficha #32, no en esta.
- **Estados:**
  - Vacío: no aplica — siempre parte de una fila existente.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `404` — cubre tanto "no existe" como "un docente
    fuera de scope" (opacidad RLS intencional: 404, no 403, decisión
    explícita documentada en `CLAUDE.md`). `422` (parcial fuera de
    `[0,10]`). Sin 403 propio de este endpoint — el filtrado es todo
    vía RLS/404. `500` poco probable (no hay UNIQUE que una corrección
    pueda violar).
- **Accesibilidad (delta):** mismo piso de **touch targets ≥44×44px
  CSS** que la ficha #22 (mismo contexto de salón de clase). Resultado
  del submit por `aria-live="assertive"` (afecta una calificación ya
  oficial, potencialmente hecha por otra persona si corrige X/A).

### 24. `PUT /personal/{id_personal}` — Edición de personal

- **Rol(es):** A únicamente.
- **Datos que muestra:** estado inicial = datos actuales del registro
  (mismos campos que ficha #9). Formulario `PersonalUpdate` edita:
  `nombre`, `apellido_paterno`, `apellido_materno`, `telefono`,
  `fecha_ingreso`, `rol`, `estatus`. **No editables aquí:** `curp`,
  `email_institucional`, `id_plantel` (implicaciones de identidad/login,
  fuera de alcance a propósito, ver docstring de `PersonalUpdate`).
- **Acciones disponibles:** editar (`U`), incluye cambiar `rol` y dar de
  baja (`estatus`).
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403` (D o X). `404`. `409` — el único admin activo
    intentó auto-degradarse o auto-darse de baja
    (`LastActiveAdminError`, mensaje ya traducido: "No se puede dar de
    baja ni cambiar el rol del único admin activo"). `422`. Sin riesgo
    de 500: `curp`/`email_institucional` no son editables aquí, así que
    sus UNIQUE no se pueden violar desde este formulario.
- **Accesibilidad (delta):** cambiar `rol` o `estatus` se anuncia con
  `aria-live="assertive"` — puede revocar el acceso de otra persona en
  vivo. El error `409` (guard del único admin) también, con mensaje
  explícito de por qué se bloqueó, no solo "error".

### 25. `PUT /grupo/{id_grupo}` — Edición de grupo

- **Rol(es):** X, A.
- **Datos que muestra:** estado inicial = datos actuales (ficha #10).
  Formulario `GrupoUpdate` edita: `id_periodo`, `semestre`,
  `nombre_grupo`, `capacidad_maxima`.
- **Acciones disponibles:** editar (`U`).
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403`. `404`. `422`. `500` —
    `uq_grupo_nombre_periodo` si el nuevo `nombre_grupo`+`id_periodo`
    ya lo usa otro grupo (ver Nota transversal).
- **Accesibilidad (delta):** ninguna adicional.

### 26. `PUT /asignatura/{id_asignatura}` — Edición de asignatura

- **Rol(es):** X, A.
- **Datos que muestra:** estado inicial = datos actuales (ficha #12).
  Formulario `AsignaturaUpdate` edita: `nombre`, `semestre`, `activa`.
  `clave_asignatura` no es editable aquí (no está en `AsignaturaUpdate`).
- **Acciones disponibles:** editar (`U`) — incluye desactivar la materia
  (`activa=false`) sin borrarla.
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403`. `404`. `422`. Sin riesgo de 500:
    `clave_asignatura` (la única UNIQUE de la entidad) no es editable
    aquí.
- **Accesibilidad (delta):** ninguna adicional.

### 27. `PUT /grupo-asignatura/{id_grupo_asig}` — Edición de asignación

- **Rol(es):** X, A.
- **Datos que muestra:** estado inicial = datos actuales (ficha #14).
  Formulario `GrupoAsignaturaUpdate` edita: `id_docente`, `id_periodo`.
  `id_grupo`/`id_asignatura` no son editables aquí (para reasignarlos
  se crea una nueva asignación, ficha #15).
- **Acciones disponibles:** editar (`U`) — reasignar docente o mover a
  otro periodo.
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403`. `404`. `400` — mismo `DocenteInvalidoError` que
    la ficha #15 si el nuevo `id_docente` no tiene `rol='docente'`.
    `422`. `500` — `uq_grupo_asignatura_periodo` si el nuevo
    `id_periodo` colisiona con `id_grupo`+`id_asignatura` ya existentes
    (ver Nota transversal).
- **Accesibilidad (delta):** el error `400` se anuncia igual que en la
  ficha #15 (regla de negocio, no typo de formato).

### 28. `PUT /alumno/{id_alumno}` — Edición de alumno

- **Rol(es):** X, A.
- **Datos que muestra:** estado inicial = datos actuales en vista
  `AlumnoOutDirectivo` (todos los campos, ficha #16). Formulario
  `AlumnoUpdate` edita: `id_grupo`, `matricula`, `nombre`,
  `apellido_paterno`, `apellido_materno`, `fecha_nacimiento`, `sexo`,
  `email`, `telefono_personal`, `estatus`, `fecha_baja`. `curp` no es
  editable aquí.
- **Acciones disponibles:** editar (`U`) — incluye dar de baja
  (`estatus`+`fecha_baja`) y reasignar de grupo sin pasar por "inscribir"
  (ficha #18 es la acción dedicada, pero el campo también vive aquí).
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403`. `404`. `422`. `500` — `matricula` UNIQUE si
    colisiona con otro alumno (ver Nota transversal).
- **Accesibilidad (delta):** dar de baja (`estatus`) se anuncia con
  `aria-live="assertive"` — afecta si el alumno sigue apareciendo en
  listados operativos de docentes.

### 29. `PUT /expediente-academico/{id_alumno}` — Edición de expediente académico

- **Rol(es):** X, A.
- **Datos que muestra:** estado inicial = datos actuales (ficha #20,
  puede tener campos en `null`). Formulario `ExpedienteAcademicoUpdate`
  edita: `escuela_procedencia`, `promedio_secundaria`,
  `promedio_actual`, `situacion_academica`.
- **Acciones disponibles:** editar (`U`). **Nota:** `promedio_actual`
  normalmente lo recalcula el backend vía `fn_actualizar_promedio_actual`
  al capturar/corregir una calificación (SECURITY DEFINER, mismo patrón
  que ADR-007) — editarlo manualmente aquí lo sobrescribe hasta la
  siguiente captura. Vale la pena un texto de advertencia en el
  formulario (contenido, no diseño visual) si se toca ese campo a mano.
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403`. `404`. `422`. Sin riesgo de 500 (sin UNIQUE en
    los campos editables aquí).
- **Accesibilidad (delta):** ninguna adicional.

### 30. `GET /plantel` — Detalle del plantel

- **Rol(es):** D, X, A.
- **Datos que muestra:** `list[PlantelOut]` (técnicamente una lista de
  1 elemento — fila única del MVP): `id_plantel`, `clave_plantel`,
  `nombre_plantel`, `municipio`, `estado`, `domicilio` (opcional),
  `telefono` (opcional), `email` (opcional), `estatus`.
- **Acciones disponibles:** D — solo consultar. X, A — consultar y
  navegar a edición (→ ficha #31).
- **Estados:**
  - Vacío: defensivo únicamente — la fila la siembra la migración, no
    debería faltar nunca.
  - Carga: skeleton de campos.
  - Error: `401`. `500`.
- **Accesibilidad (delta):** ninguna adicional.

### 31. `PUT /plantel` — Edición del plantel

- **Rol(es):** X, A.
- **Datos que muestra:** estado inicial = datos actuales (ficha #30).
  Formulario `PlantelUpdate` (implementado en esta misma fase) edita
  cualquiera de: `clave_plantel`, `nombre_plantel`, `municipio`,
  `estado`, `domicilio`, `telefono`, `email`, `estatus`. Sin `{id}` en
  el path — es la única fila del MVP, no hay selector de "cuál plantel".
- **Acciones disponibles:** editar (`U`).
- **Estados:**
  - Vacío: no aplica.
  - Carga: botón deshabilitado durante el PUT.
  - Error: `401`. `403`. `404` (caso límite — la fila no existe, ver
    `service.update_plantel`). `422`. Sin riesgo real de 500 por
    `clave_plantel` UNIQUE: solo hay 1 fila, un `UPDATE` no puede
    colisionar consigo mismo.
- **Accesibilidad (delta):** ninguna adicional.

### 32. `GET /auditoria-calificacion` — Bitácora de auditoría de calificaciones

- **Rol(es):** X, A únicamente (`require_roles("directivo", "admin")` —
  D ve `403`).
- **Datos que muestra:** `list[AuditoriaCalificacionOut]`:
  `id_auditoria`, `id_calificacion`, `id_personal_capturo` (nullable),
  `id_personal_modifico` (nullable), `accion`
  (`captura`\|`correccion`, `chk_auditoria_accion`),
  `valores_anteriores` (dict, nullable — `null` en la fila de
  `captura`, hay valores en `correccion`), `valores_nuevos` (dict),
  `fecha_evento`.
- **Acciones disponibles:** solo lectura (`R`) — tabla append-only,
  confirmado sin endpoint `PUT`/`DELETE` (`405`) y sin política RLS de
  escritura para ningún rol, incluido `admin` (`CLAUDE.md`, cierre de
  Fase 5). No hay ninguna acción de escritura que ofrecer en esta
  pantalla, ni para `A`.
- **Estados:**
  - Vacío: plantel sin capturas/correcciones registradas todavía
    (extremadamente raro en la práctica, ya que toda captura genera una
    fila de auditoría, pero posible en un plantel recién sembrado).
  - Carga: skeleton de filas.
  - Error: `401`. `403` (D). `500`.
- **Accesibilidad (delta):** `valores_anteriores`/`valores_nuevos` son
  JSON crudo — deben presentarse como texto estructurado legible por
  lector de pantalla (ej. lista de pares campo/valor), no como un
  bloque de JSON sin procesar volcado en el DOM.
