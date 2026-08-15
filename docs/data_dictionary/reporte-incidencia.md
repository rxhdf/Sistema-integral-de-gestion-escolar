# Reporte_Incidencia — Diseño (post-MVP, feature nueva)

**Decisiones confirmadas en sesión:**
1. Cualquier `Personal` con `rol='docente'` y `estatus='activo'` puede
   levantar un reporte sobre **cualquier alumno del plantel**, sin
   requerir relación vía `grupo_asignatura` — a diferencia de
   `Calificacion`/`Asistencia`. Justificación de negocio: una incidencia
   (conducta, disciplina, salud, etc.) puede presenciarla cualquier
   docente del plantel, no solo quien le da clase al alumno — ver
   ADR-010 para el razonamiento completo y por qué esto no reabre el
   patrón de scope de `Calificacion`/`Asistencia`.
2. Tabla **inmutable**: ningún rol puede corregir ni borrar un reporte
   una vez creado (ni siquiera `admin`) — mismo criterio que
   `Auditoria_Calificacion`.
3. Sin `UNIQUE` compuesto: un alumno puede tener varios reportes el
   mismo día, de distintos docentes (o del mismo).

---

## Diccionario de datos

### REPORTE_INCIDENCIA

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_reporte_incidencia` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del reporte. |
| `id_alumno` | `INT` (FK → `alumno.id_alumno`) | `NOT NULL` | Ninguna | Alumno sobre el que se reporta. |
| `id_personal_reporta` | `INT` (FK → `personal.id_personal`) | `NOT NULL` | Ninguna | Docente que levantó el reporte (fijado por el backend desde el JWT, nunca desde el payload — anti-suplantación). |
| `fecha_incidente` | `DATE` | `NOT NULL` | Académica-restringida | Fecha en que ocurrió la incidencia (puede diferir de cuándo se registró). |
| `descripcion` | `TEXT` | `NOT NULL` | Académica-restringida | Narrativa libre del docente. |
| `fecha_registro` | `TIMESTAMP` | `NOT NULL`, default `now()` | Ninguna | Cuándo se capturó el reporte en el sistema. |

Sin `UNIQUE` compuesto (decisión #3 arriba).

**Índices de rendimiento:**
- `idx_reporte_incidencia_alumno` sobre `(id_alumno)` — para la sección
  "Incidencias" del Perfil de Análisis de Alumno (`GET
  /reporte-incidencia?id_alumno=`).
- `idx_reporte_incidencia_personal_reporta` sobre `(id_personal_reporta)`
  — para el scope de lectura del propio docente (`reporte_incidencia_select`
  filtra por esta columna en cada request suyo).

---

## Matriz RBAC — Reporte_Incidencia

| Operación | Docente | Directivo | Admin |
|---|---|---|---|
| Crear | Sí, activo, cualquier alumno del plantel (sin requerir `grupo_asignatura`) | No | No |
| Consultar | Sí, solo los que él mismo levantó (`id_personal_reporta = propio`) | Sí, todo el plantel | Sí, todo el plantel |
| Corregir / Borrar | No | No | No — tabla inmutable, sin excepción por rol |

---

## Endpoints

```
POST /reporte-incidencia          (solo docente activo)
{
  "id_alumno": 12,
  "fecha_incidente": "2026-08-14",
  "descripcion": "Se presentó sin material de trabajo, tercera vez en la semana."
}
```

```
GET /reporte-incidencia?id_alumno=12   (scope según rol, id_alumno opcional)
```

Sin `PUT`/`DELETE` — no existen, a propósito (ver "Decisiones confirmadas" #2).

---

## Excepción de búsqueda para docente (ver ADR-010)

El scope normal de `GET /alumno` para un docente está limitado a los
alumnos de sus propios `grupo_asignatura` (RLS de `alumno_select`). Como
esta feature exige que el docente pueda reportar sobre **cualquier**
alumno del plantel, necesita poder buscarlo primero — reutilizar `GET
/alumno?search=` tal cual no alcanza (seguiría acotado a su scope).

Se agrega un endpoint nuevo, exclusivo de este flujo:

```
GET /alumno/buscar-plantel?search=<nombre o CURP>   (solo docente)
```

Respaldado por una función `SECURITY DEFINER` (`fn_alumno_buscar_docente`,
mismo patrón acotado que `fn_login_lookup`, ADR-007) que devuelve solo
campos mínimos de identificación (`id_alumno`, `matricula`, `nombre`,
`apellido_paterno`, `apellido_materno`) para **cualquier** alumno del
plantel, sin pasar por `alumno_select`. No amplía el scope general de
lectura de `Alumno` — es una función nueva, de un solo propósito, no una
modificación a la política existente.

---

## Decisiones resueltas

1. **Sin campos `tipo`/`gravedad`**: fuera de alcance de este diseño —
   el pedido original solo especifica alumno, fecha del incidente y
   descripción libre. Se puede agregar después si el negocio lo pide,
   sin romper lo ya construido (columna nueva nullable).
2. **`fecha_registro` vs. `fecha_incidente`**: mismo criterio que
   `Asistencia` (`fecha_captura` vs. `fecha_sesion`) — no confundir
   cuándo ocurrió con cuándo se capturó.
