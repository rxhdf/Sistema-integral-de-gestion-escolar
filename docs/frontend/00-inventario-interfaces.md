# Inventario de interfaces de usuario — SIGE MVP

Lista plana de las interfaces necesarias, derivada directamente de los
routers reales (`app/domains/*/router.py`) y de
`docs/rbac/matriz-rbac-mvp.md`. Sin orden ni prioridad — eso es la
siguiente capa. Sin diseño visual ni de contenido.

Roles abreviados: `D` = docente, `X` = directivo, `A` = admin.

## `app/domains/organizacional/router.py`

| # | Endpoint(s) | Entidad | Rol(es) | Tipo de interfaz |
|---|---|---|---|---|
| 1 | `GET /plantel` | Plantel | D, X, A | Vista de detalle (fila única, sin alta vía API) |
| 2 | `PUT /plantel` | Plantel | X, A | Formulario de edición (fila única, sin `{id}` en el path) |
| 3 | `GET /ciclo-escolar` | Ciclo_Escolar | D, X, A | Tabla de listado |
| 4 | `POST /ciclo-escolar` | Ciclo_Escolar | X, A | Formulario de alta |
| 5 | `GET /periodo-semestral` | Periodo_Semestral | D, X, A | Tabla de listado |
| 6 | `POST /periodo-semestral` | Periodo_Semestral | X, A | Formulario de alta |
| 7 | `PUT /periodo-semestral/{id_periodo}` | Periodo_Semestral | X, A | Acción de edición (activar/desactivar) |

## `app/domains/personal/router.py`

| # | Endpoint(s) | Entidad | Rol(es) | Tipo de interfaz |
|---|---|---|---|---|
| 8 | `POST /auth/login` | Personal (auth) | público (sin rol) | Formulario de login |
| 9 | `POST /personal` | Personal | A | Formulario de alta |
| 10 | `GET /personal` | Personal | X, A | Tabla de listado (todo el plantel) |
| 11 | `GET /personal/me` | Personal | D, X, A | Vista de detalle (perfil propio) |
| 12 | `PUT /personal/{id_personal}` | Personal | A | Formulario de edición (incluye rol y baja) |

## `app/domains/academico/router.py`

| # | Endpoint(s) | Entidad | Rol(es) | Tipo de interfaz |
|---|---|---|---|---|
| 13 | `GET /grupo` | Grupo | D, X, A | Tabla de listado |
| 14 | `POST /grupo` | Grupo | X, A | Formulario de alta |
| 15 | `PUT /grupo/{id_grupo}` | Grupo | X, A | Formulario de edición |
| 16 | `GET /asignatura` | Asignatura | D, X, A | Tabla de listado |
| 17 | `POST /asignatura` | Asignatura | X, A | Formulario de alta |
| 18 | `PUT /asignatura/{id_asignatura}` | Asignatura | X, A | Formulario de edición |
| 19 | `GET /grupo-asignatura` | Grupo_Asignatura | D (solo las suyas), X, A | Tabla de listado |
| 20 | `POST /grupo-asignatura` | Grupo_Asignatura | X, A | Formulario de alta (asignar docente a grupo+materia) |
| 21 | `PUT /grupo-asignatura/{id_grupo_asig}` | Grupo_Asignatura | X, A | Formulario de edición |

## `app/domains/alumnos/router.py`

| # | Endpoint(s) | Entidad | Rol(es) | Tipo de interfaz |
|---|---|---|---|---|
| 22 | `GET /alumno` | Alumno | D (campos limitados), X, A | Tabla de listado |
| 23 | `POST /alumno` | Alumno | X, A | Formulario de alta |
| 24 | `PUT /alumno/{id_alumno}` | Alumno | X, A | Formulario de edición |
| 25 | `POST /alumno/{id_alumno}/inscribir` | Alumno | X, A | Formulario/acción de inscripción |
| 26 | `GET /expediente-academico/{id_alumno}` | Expediente_Academico | D (campos limitados), X, A | Vista de detalle |
| 27 | `POST /expediente-academico` | Expediente_Academico | X, A | Formulario de alta |
| 28 | `PUT /expediente-academico/{id_alumno}` | Expediente_Academico | X, A | Formulario de edición |

## `app/domains/control_escolar/router.py`

| # | Endpoint(s) | Entidad | Rol(es) | Tipo de interfaz |
|---|---|---|---|---|
| 29 | `GET /calificacion` | Calificacion | D (solo sus grupo_asignatura), X, A | Tabla de listado |
| 30 | `POST /calificacion` | Calificacion | D | Formulario de captura |
| 31 | `PUT /calificacion/{id_calificacion}` | Calificacion | D (solo sus grupo_asignatura), X, A | Formulario de corrección |
| 32 | `GET /auditoria-calificacion` | Auditoria_Calificacion | X, A | Tabla de listado (solo lectura, append-only) |

## Notas de alcance

- 32 endpoints reales, 6 routers (incluye `auth_router` de login).
- `GET /alumno` y `GET /expediente-academico/{id_alumno}` devuelven
  payloads distintos según rol (campos ocultos a docente, matriz RBAC
  Nivel 3) — es la misma interfaz de UI, no dos interfaces separadas;
  el filtrado de campos ya ocurre en el backend.
