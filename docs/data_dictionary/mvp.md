# SIGE MVP — Diccionario de Datos

**Alcance:** 10 entidades del MVP (ver `SIGE_MVP_Brief_ClaudeCode.md`).
**Fuente:** derivado y simplificado de `Modelo_Conceptual_Gestion_Estudiantil.md` v1.0.
**Convención de nulabilidad:** se marca explícito `NOT NULL` o `NULL` en vez de dejarlo implícito, ya que el documento original no lo especificaba y es una decisión que debe tomarse por campo.

**Columna "Sensibilidad":**
- `Ninguna` — dato operativo/público dentro del plantel.
- `Ordinaria` — dato personal identificable (protegido por RLS de rol, sin cifrado especial).
- `Académica-restringida` — promedios/rendimiento; visible según matriz RBAC, no público entre docentes de otras materias.

---

## 1. PLANTEL

Una sola fila en el MVP. Se mantiene como tabla (no config hardcodeada) para no romper el esquema si se expande a más planteles después.

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_plantel` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del plantel. |
| `clave_plantel` | `VARCHAR(20)` | `NOT NULL`, `UNIQUE` | Ninguna | Clave oficial del plantel ante la SEP. |
| `nombre_plantel` | `VARCHAR(200)` | `NOT NULL` | Ninguna | Nombre completo del plantel. |
| `municipio` | `VARCHAR(100)` | `NOT NULL` | Ninguna | Municipio donde se ubica. |
| `estado` | `VARCHAR(80)` | `NOT NULL` | Ninguna | Estado de la República. |
| `domicilio` | `VARCHAR(300)` | `NULL` | Ninguna | Domicilio completo. |
| `telefono` | `VARCHAR(20)` | `NULL` | Ninguna | Teléfono de contacto. |
| `email` | `VARCHAR(100)` | `NULL` | Ninguna | Correo institucional del plantel. |
| `estatus` | `VARCHAR(20)` | `NOT NULL`, default `'activo'` | Ninguna | Estado operativo (activo/inactivo). |

---

## 2. CICLO_ESCOLAR

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_ciclo` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del ciclo anual. |
| `nombre` | `VARCHAR(20)` | `NOT NULL`, `UNIQUE` | Ninguna | Nombre descriptivo (ej. `2026-2027`). |
| `fecha_inicio` | `DATE` | `NOT NULL` | Ninguna | Inicio del ciclo anual. |
| `fecha_fin` | `DATE` | `NOT NULL` | Ninguna | Cierre del ciclo anual. |
| `activo` | `BOOLEAN` | `NOT NULL`, default `false` | Ninguna | Indica si es el ciclo en curso. **Regla de negocio:** solo un ciclo puede estar `activo=true` a la vez (constraint o validación en service). |

---

## 3. PERIODO_SEMESTRAL

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_periodo` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del período semestral. |
| `id_ciclo` | `INT` (FK → `ciclo_escolar.id_ciclo`) | `NOT NULL` | Ninguna | Ciclo al que pertenece. |
| `clave_periodo` | `VARCHAR(10)` | `NOT NULL`, `UNIQUE` | Ninguna | Clave corta (ej. `2026A`, `2026B`). |
| `numero_periodo` | `SMALLINT` | `NOT NULL`, check `IN (1,2)` | Ninguna | 1 = ago-ene (nones), 2 = feb-jul (pares). |
| `fecha_inicio` | `DATE` | `NOT NULL` | Ninguna | Inicio de clases del período. |
| `fecha_fin` | `DATE` | `NOT NULL` | Ninguna | Término de clases del período. |
| `activo` | `BOOLEAN` | `NOT NULL`, default `false` | Ninguna | Período semestral en curso. |

---

## 4. PERSONAL

**Simplificación intencional (ver ADR-002):** un solo campo `rol` en vez de tablas `DIRECTOR`/`SUBDIRECTOR`/`ORIENTADOR_EDUCATIVO`/`DOCENTE` separadas.

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_personal` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del trabajador. |
| `id_plantel` | `INT` (FK → `plantel.id_plantel`) | `NOT NULL` | Ninguna | Plantel de adscripción. |
| `curp` | `CHAR(18)` | `NOT NULL`, `UNIQUE` | Ordinaria | CURP del trabajador. |
| `nombre` | `VARCHAR(80)` | `NOT NULL` | Ordinaria | Nombre(s). |
| `apellido_paterno` | `VARCHAR(60)` | `NOT NULL` | Ordinaria | Primer apellido. |
| `apellido_materno` | `VARCHAR(60)` | `NULL` | Ordinaria | Segundo apellido. |
| `email_institucional` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Ordinaria | Correo de acceso al sistema (login). |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Ordinaria | Hash bcrypt de la contraseña. Nunca se expone en respuestas de API. |
| `rol` | `VARCHAR(20)` | `NOT NULL`, check `IN ('docente','directivo','admin')` | Ninguna | Rol funcional dentro del MVP. `admin` ⊇ `directivo` en todo lo académico; la diferencia es que solo `admin` gestiona cuentas de `Personal` (ver ADR-003). |
| `telefono` | `VARCHAR(20)` | `NULL` | Ordinaria | Teléfono de contacto. |
| `fecha_ingreso` | `DATE` | `NULL` | Ninguna | Fecha de ingreso al plantel. |
| `estatus` | `VARCHAR(20)` | `NOT NULL`, default `'activo'` | Ninguna | Situación laboral (activo/baja). |

---

## 5. GRUPO

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_grupo` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del grupo. |
| `id_plantel` | `INT` (FK → `plantel.id_plantel`) | `NOT NULL` | Ninguna | Plantel al que pertenece. |
| `id_periodo` | `INT` (FK → `periodo_semestral.id_periodo`) | `NOT NULL` | Ninguna | Período semestral del grupo. |
| `semestre` | `SMALLINT` | `NOT NULL`, check `BETWEEN 1 AND 6` | Ninguna | Semestre que cursan los alumnos (reemplaza catálogo `SEMESTRE` separado; simplificación del MVP). |
| `nombre_grupo` | `VARCHAR(10)` | `NOT NULL` | Ninguna | Identificador alfanumérico (ej. `1A`, `3B`). |
| `capacidad_maxima` | `INT` | `NULL` | Ninguna | Cupo máximo del grupo. |

**Nota:** `num_alumnos_inscritos` **no** se modela como columna (ver ADR-001 heredado del modelo completo) — se calcula vía `COUNT(*)` sobre `alumno.id_grupo` o una vista, para evitar desincronización.

---

## 6. ASIGNATURA

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_asignatura` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único de la asignatura. |
| `clave_asignatura` | `VARCHAR(20)` | `NOT NULL`, `UNIQUE` | Ninguna | Clave oficial (SEP/DGB). |
| `nombre` | `VARCHAR(120)` | `NOT NULL` | Ninguna | Nombre completo de la materia. |
| `semestre` | `SMALLINT` | `NOT NULL`, check `BETWEEN 1 AND 6` | Ninguna | Semestre en que se imparte. |
| `activa` | `BOOLEAN` | `NOT NULL`, default `true` | Ninguna | Vigencia en el plan de estudios actual. |

---

## 7. GRUPO_ASIGNATURA

Punto de control central: define qué docente imparte qué materia a qué grupo. Toda `CALIFICACION` se ancla aquí.

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_grupo_asig` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único de la asignación. |
| `id_grupo` | `INT` (FK → `grupo.id_grupo`) | `NOT NULL` | Ninguna | Grupo que recibe la asignatura. |
| `id_asignatura` | `INT` (FK → `asignatura.id_asignatura`) | `NOT NULL` | Ninguna | Asignatura impartida. |
| `id_docente` | `INT` (FK → `personal.id_personal`) | `NOT NULL` | Ninguna | Docente responsable. **Constraint de aplicación:** debe validarse que `personal.rol = 'docente'`. |
| `id_periodo` | `INT` (FK → `periodo_semestral.id_periodo`) | `NOT NULL` | Ninguna | Período semestral de la asignación. |

**Constraint recomendado:** `UNIQUE (id_grupo, id_asignatura, id_periodo)` — no puede haber dos docentes para la misma materia en el mismo grupo y período (a menos que el negocio diga lo contrario; validar con plantel piloto).

---

## 8. ALUMNO

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_alumno` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del alumno. |
| `id_plantel` | `INT` (FK → `plantel.id_plantel`) | `NOT NULL` | Ninguna | Plantel donde está inscrito. |
| `id_grupo` | `INT` (FK → `grupo.id_grupo`) | `NULL` | Ninguna | Grupo actual (nulo antes de inscripción). |
| `matricula` | `VARCHAR(20)` | `NOT NULL`, `UNIQUE` | Ordinaria | Número de matrícula escolar. |
| `curp` | `CHAR(18)` | `NOT NULL`, `UNIQUE` | Ordinaria | CURP del alumno. |
| `nombre` | `VARCHAR(80)` | `NOT NULL` | Ordinaria | Nombre(s). |
| `apellido_paterno` | `VARCHAR(60)` | `NOT NULL` | Ordinaria | Primer apellido. |
| `apellido_materno` | `VARCHAR(60)` | `NULL` | Ordinaria | Segundo apellido. |
| `fecha_nacimiento` | `DATE` | `NOT NULL` | Ordinaria | Fecha de nacimiento. |
| `sexo` | `CHAR(1)` | `NULL` | Ordinaria | M/F. |
| `email` | `VARCHAR(100)` | `NULL` | Ordinaria | Correo del alumno. |
| `telefono_personal` | `VARCHAR(20)` | `NULL` | Ordinaria | Teléfono celular. |
| `estatus` | `VARCHAR(20)` | `NOT NULL`, default `'activo'` | Ninguna | activo / baja / egresado. |
| `fecha_inscripcion` | `DATE` | `NOT NULL` | Ninguna | Fecha de inscripción al plantel. |
| `fecha_baja` | `DATE` | `NULL` | Ninguna | Fecha de baja/egreso. |

**Fuera del MVP (deliberado):** `municipio_origen`, `poblacion`, `indigena`, `lengua_indigena`, `foto` — pertenecen a enriquecimiento demográfico no crítico para "expediente + calificaciones".

---

## 9. EXPEDIENTE_ACADEMICO

Único expediente incluido en el MVP (Personal y Escolar quedan fuera, ver brief).

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_exp_academico` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del expediente. |
| `id_alumno` | `INT` (FK → `alumno.id_alumno`, `UNIQUE`) | `NOT NULL` | Ninguna | Relación 1:1 con alumno. |
| `escuela_procedencia` | `VARCHAR(200)` | `NULL` | Ordinaria | Secundaria de procedencia. |
| `promedio_secundaria` | `DECIMAL(4,2)` | `NULL` | Académica-restringida | Promedio de secundaria. |
| `promedio_actual` | `DECIMAL(4,2)` | `NULL` | Académica-restringida | Promedio acumulado en bachillerato. Recomendado como **valor calculado** (no capturado a mano) a partir de `CALIFICACION`, para evitar desincronización — decidir en ADR si es columna con trigger o vista. |
| `situacion_academica` | `VARCHAR(20)` | `NOT NULL`, default `'regular'` | Académica-restringida | regular / irregular / condicionado. |

---

## 10. CALIFICACION

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_calificacion` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del registro. |
| `id_alumno` | `INT` (FK → `alumno.id_alumno`) | `NOT NULL` | Ninguna | Alumno evaluado. |
| `id_grupo_asig` | `INT` (FK → `grupo_asignatura.id_grupo_asig`) | `NOT NULL` | Ninguna | Asignatura+grupo+docente+período evaluado. |
| `parcial_1` | `DECIMAL(4,1)` | `NULL`, check `BETWEEN 0 AND 10` | Académica-restringida | Primer parcial. |
| `parcial_2` | `DECIMAL(4,1)` | `NULL`, check `BETWEEN 0 AND 10` | Académica-restringida | Segundo parcial. |
| `parcial_3` | `DECIMAL(4,1)` | `NULL`, check `BETWEEN 0 AND 10` | Académica-restringida | Tercer parcial. |
| `calificacion_final` | `DECIMAL(4,1)` | `NULL`, check `BETWEEN 0 AND 10` | Académica-restringida | Final del semestre. **Decidir en ADR** si se calcula (trigger/service) o se captura manualmente. |
| `tipo_evaluacion` | `VARCHAR(20)` | `NOT NULL`, default `'ordinaria'` | Ninguna | ordinaria / extraordinaria. |
| `estatus` | `VARCHAR(15)` | `NOT NULL`, default `'pendiente'`, check `IN ('aprobado','reprobado','pendiente')` | Académica-restringida | Derivado de `calificacion_final` (ej. `>=6` aprobado). |
| `fecha_captura` | `TIMESTAMP` | `NOT NULL`, default `now()` | Ninguna | Fecha/hora de registro. |

**Constraint recomendado:** `UNIQUE (id_alumno, id_grupo_asig)` — una sola fila de calificación por alumno por asignatura-grupo-período.

**Auditoría (requisito no negociable del brief):** cada `INSERT`/`UPDATE` sobre esta tabla debe generar una fila en una tabla de auditoría append-only separada (`auditoria_calificacion` o similar) con `id_personal` que hizo el cambio, `accion`, `valores_anteriores`/`valores_nuevos`, `timestamp`. No incluida como entidad numerada porque es infraestructura transversal, no dominio — definir su modelo en la Etapa 4 (ERD/DDL) junto con las 10 tablas.

---

## Pendientes que este documento deja explícitos (no resueltos aquí)

1. ~~`promedio_actual` y `calificacion_final`: columna simple vs. calculado~~ — **Resuelto:** ambos se calculan en el service de FastAPI al guardar (ver ADR-005). No son trigger ni vista.
2. **Constraint de unicidad en `GRUPO_ASIGNATURA`**: validar con plantel piloto si un grupo puede tener 2 docentes distintos para la misma materia en el mismo período (ej. por partición de grupo grande).
3. **Regla exacta de "estatus aprobado/reprobado"**: confirmar el umbral real usado por la institución (asumido `>=6` arriba, típico en México, pero debe confirmarse).