# Asistencia — Diseño (post-MVP, primera feature nueva)

**Decisiones confirmadas en sesión:**
1. Registro por SESIÓN individual: una fila por alumno × grupo_asignatura × fecha de clase.
2. 3 estados: presente / ausente / retardo.
3. Captura en LOTE (todo el grupo de una vez, un solo submit), no fila por fila.

---

## Diccionario de datos

### ASISTENCIA

| Campo | Tipo | Nulabilidad | Sensibilidad | Descripción |
|---|---|---|---|---|
| `id_asistencia` | `SERIAL` (PK) | `NOT NULL` | Ninguna | Identificador único del registro. |
| `id_alumno` | `INT` (FK → `alumno.id_alumno`) | `NOT NULL` | Ninguna | Alumno registrado. |
| `id_grupo_asig` | `INT` (FK → `grupo_asignatura.id_grupo_asig`) | `NOT NULL` | Ninguna | Sesión de qué materia/grupo/docente/periodo. |
| `fecha_sesion` | `DATE` | `NOT NULL` | Ninguna | Fecha específica de la clase. |
| `estado` | `VARCHAR(10)` | `NOT NULL`, check `IN ('presente','ausente','retardo')` | Académica-restringida | Estado de asistencia. |
| `id_personal_registro` | `INT` (FK → `personal.id_personal`) | `NOT NULL` | Ninguna | Quién capturó (para auditoría, mismo patrón que Calificacion). |
| `fecha_captura` | `TIMESTAMP` | `NOT NULL`, default `now()` | Ninguna | Cuándo se registró (no confundir con fecha_sesion). |

**Constraint clave:** `UNIQUE (id_alumno, id_grupo_asig, fecha_sesion)` — evita doble captura del mismo alumno, misma materia, mismo día.

**Índices de rendimiento (no solo integridad):**
- `idx_asistencia_alumno_periodo` sobre `(id_alumno)` — para resúmenes de asistencia por alumno.
- `idx_asistencia_grupo_fecha` sobre `(id_grupo_asig, fecha_sesion)` — para la vista diaria de captura, la consulta más frecuente del sistema.

---

## Matriz RBAC — Asistencia

| Operación | Docente | Directivo | Admin |
|---|---|---|---|
| Capturar (lote) | Sí, solo sus propios `grupo_asignatura` | No | No |
| Consultar | Sí, solo sus grupos | Sí, todo el plantel | Sí, todo el plantel |
| Corregir un registro ya capturado | Sí, solo lo que él mismo capturó | Sí, cualquiera (mismo criterio que ADR-004 con Calificacion) | Sí, cualquiera |

Mismo patrón de scope que `Calificacion` — reutiliza exactamente la misma lógica de RLS ya validada (`WHERE id_grupo_asig IN (SELECT ... WHERE id_docente = current_personal)`).

---

## Endpoint de captura en lote

```
POST /asistencia/lote
{
  "id_grupo_asig": 12,
  "fecha_sesion": "2026-08-12",
  "registros": [
    { "id_alumno": 1, "estado": "presente" },
    { "id_alumno": 2, "estado": "ausente" },
    { "id_alumno": 3, "estado": "retardo" }
  ]
}
```

Inserta todas las filas en una sola transacción. Si el docente ya capturó ese grupo+fecha antes, debe poder reemplazar (UPSERT sobre el `UNIQUE` compuesto), no fallar con 409 — es un caso de uso normal (corrección del mismo día), a diferencia de Calificacion donde duplicado sí es error.

---

## Decisiones resueltas

1. **Días sin clase**: no se genera ningún registro. Un "hueco" en los
   datos (sin fila para ese alumno-grupo-fecha) simplemente significa
   "no hubo captura ese día" — no se distingue de "no hubo clase". Evita
   un estado adicional (`sin_sesion`) que no aporta valor real de negocio.

2. **Resumen de faltas/retardos por alumno**: calculado al vuelo (query
   agregada `COUNT ... GROUP BY estado`), NO persistido como columna.
   Mismo criterio ya aplicado a `Grupo.num_alumnos_inscritos` y
   `Plantel.matricula_total` — evita que un campo calculado se
   desincronice del dato real. El índice `idx_asistencia_alumno_periodo`
   ya diseñado hace esta consulta eficiente sin necesidad de cachear el
   resultado.