# Perfil de Análisis de Alumno — Diseño (feature post-MVP)

**Contexto de negocio:** un directivo recibe un reporte (disciplinario,
de conducta, etc.) sobre un alumno y necesita localizarlo rápido (por
nombre completo o CURP, dato disponible en su credencial física) y ver
un perfil consolidado que le dé contexto suficiente para tomar una
decisión — sin exponer datos que no aportan a ese análisis (dirección
exacta, teléfono personal, etc.).

**Roles:** exclusivo de directivo/admin. Docente no tiene este caso de
uso.

---

## Pieza 1 — Cambio de esquema: nuevos campos en Alumno

Estos campos existían en el modelo conceptual original pero quedaron
fuera del MVP (ADR-002). Se agregan ahora, de forma acotada:

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `municipio_origen` | `VARCHAR(100)` | `NULL` | Ordinaria | Municipio de procedencia del alumno. |
| `localidad_origen` | `VARCHAR(100)` | `NULL` | Ordinaria | Localidad/comunidad de procedencia. |

**Nota de alcance:** NO se agregan en esta iteración `indigena`,
`lengua_indigena`, ni `foto` — siguen fuera, mismo criterio de ADR-002,
salvo que se pida explícitamente después.

**Migración:** `ALTER TABLE alumno ADD COLUMN` — no rompe filas
existentes (nullable), no requiere backfill.

---

## Pieza 2 — Buscador por nombre completo / CURP

- Barra de búsqueda, visible solo para directivo/admin (a diferencia del
  diseño anterior que contemplaba también docente — se descarta esa
  parte).
- Backend: `GET /alumno?search=` (query param), busca por coincidencia
  parcial en nombre completo (concatenado) o CURP exacta.
- Scope: directivo/admin ya tienen `R` de todo el plantel — no hay
  restricción adicional de scope aquí, a diferencia del caso docente que
  se descartó.
- Resultado: lista corta (nombre, matrícula, grupo) → click navega al
  Perfil de Análisis (Pieza 3).

---

## Pieza 3 — Vista "Perfil de Análisis" (composición de 3 fuentes)

Pantalla nueva, distinta del `AlumnoEditPage`/detalle operativo ya
existente. Ancho, pensada para lectura rápida de contexto, no para
edición.

### Sección 1 — Identidad y origen
- Nombre completo, matrícula, CURP, grupo actual.
- `municipio_origen`, `localidad_origen` (Pieza 1).
- `escuela_procedencia` (ya existe en `Expediente_Academico`).
- **Explícitamente excluido:** `email`, `telefono_personal`,
  `fecha_nacimiento` no se muestran aquí tampoco — el criterio de "solo
  lo útil para análisis" aplica incluso a directivo, no es un filtro por
  rol sino de propósito de la pantalla.

### Sección 2 — Desempeño académico
- `situacion_academica`, `promedio_actual` (de `Expediente_Academico`).
- Listado de calificaciones por materia del periodo activo (reutiliza
  `GET /calificacion` con filtro por alumno, ya existe el endpoint con
  scope directivo/admin).

### Sección 3 — Asistencia
- Resumen de faltas/retardos del periodo activo, reutilizando
  `GET /asistencia/resumen/{id_alumno}` (ya construido en la feature de
  Asistencia) — sin trabajo backend nuevo aquí, solo consumir lo que ya
  existe.

---

## Endpoints nuevos/modificados — resumen

| Endpoint | Cambio |
|---|---|
| `GET /alumno?search=` | Nuevo query param sobre endpoint existente |
| `PUT/POST /alumno` | Ajustar schema para incluir municipio_origen/localidad_origen |
| `GET /alumno/{id}/perfil-analisis` | Nuevo — compone Alumno + Expediente_Academico + Calificacion + Asistencia en una sola respuesta, o el frontend compone 3-4 llamadas (decidir, mismo trade-off que "Mis grupos" del dashboard docente) |

**Pendiente de decidir contigo:** ¿un solo endpoint agregador
(`/perfil-analisis`) construido en backend, o el frontend compone las
llamadas ya existentes (más rápido de construir, mismo patrón ya usado
en "Mis grupos", con el mismo trade-off de N+1 requests ya documentado
como deuda técnica aceptable en ese caso)?