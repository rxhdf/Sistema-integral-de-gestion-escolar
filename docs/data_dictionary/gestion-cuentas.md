# Gestión de Cuentas — Diseño (feature post-MVP)

**Contexto:** el botón "Gestión de cuentas" del dashboard de admin
(mockup original de Stitch) necesita 3 capacidades nuevas, más allá del
CRUD de Personal ya existente (PersonalListPage/CreatePage/EditPage):
reseteo de contraseña, bloqueo temporal de cuenta, y log de accesos.

**Rol:** exclusivo de `admin` (mismo criterio que el resto de gestión de
Personal — directivo solo tiene R, nunca escritura sobre cuentas).

---

## Pieza 1 — Reseteo de contraseña por admin

**Decisión confirmada:** el admin genera/asigna la nueva contraseña
directamente (no flujo de "olvidé mi contraseña" con correo — evita la
complejidad de configurar envío de emails, que no existe hoy en el
sistema).

### Endpoint
`PUT /personal/{id_personal}/reset-password`
- Rol: solo `admin`.
- Body: `{ "nueva_password": "..." }` — el admin la define y se la
  comunica al usuario por fuera del sistema (verbalmente, WhatsApp, lo
  que decida la institución).
- El backend hashea con bcrypt (reutiliza `hash_password` de
  `app/core/security.py`, mismo patrón que el alta de personal) antes
  de guardar — nunca se guarda ni se transmite en texto plano más allá
  del propio request HTTPS.
- **Guard reutilizable:** aplica la misma regla de "único admin activo"
  si corresponde (ej. si el admin resetea su propia contraseña, no hay
  problema; no hay riesgo de bloqueo aquí como sí lo hay con
  cambiar/quitar el rol).

### Frontend
- Botón "Restablecer contraseña" en `PersonalListPage.tsx` (por fila) o
  en el detalle de personal — abre un modal simple con el campo de
  nueva contraseña, sin mostrar la contraseña anterior (no se puede,
  está hasheada).
- Confirmación visual clara tras el éxito ("Contraseña actualizada para
  [nombre]").

---

## Pieza 2 — Bloqueo temporal de cuenta

**Decisión de diseño:** reutilizar el campo `estatus` ya existente en
`Personal`, ampliando sus valores posibles, en vez de crear una columna
nueva — evita duplicar el concepto de "¿puede este usuario entrar o
no?" en dos lugares distintos del esquema.

### Cambio de esquema
```sql
-- Antes: estatus IN ('activo', 'baja')
-- Después:
CHECK (estatus IN ('activo', 'baja', 'bloqueado'))
```

### Efecto en login
`fn_login_lookup` (ADR-007) ya filtra por `estatus = 'activo'` — esto
significa que **con el cambio de CHECK, un `estatus = 'bloqueado'` ya
queda automáticamente rechazado en el login sin tocar esa función**,
porque solo `'activo'` pasa el filtro. Verificar esto explícitamente
antes de dar por hecho que funciona solo.

### Diferencia con "baja"
- `baja`: el personal ya no labora en el plantel (permanente,
  administrativo).
- `bloqueado`: cuenta temporalmente suspendida (ej. sospecha de acceso
  indebido, solicitud del propio usuario, medida disciplinaria) — se
  espera que pueda reactivarse a `activo` después.

### Endpoint
Reutiliza `PUT /personal/{id_personal}` ya existente (ficha #24) —
agregar `'bloqueado'` como valor válido de `estatus` en el schema
`PersonalUpdate`. No requiere endpoint nuevo, solo ampliar el enum.

### Frontend
- En `PersonalEditPage.tsx`: el selector de estatus ya existe, solo
  agregar la opción "Bloqueado".
- Considerar un botón de acceso rápido "Bloquear/Desbloquear" directo
  desde `PersonalListPage.tsx` (por fila), sin tener que entrar a
  edición completa — mismo patrón ya usado con el toggle de
  activar/desactivar en `PeriodoSemestralListPage.tsx`.

---

## Pieza 3 — Log de accesos (login exitosos y fallidos)

**Decisión confirmada:** historial completo, no solo "último login".

### Diccionario de datos — LOG_ACCESO

| Campo | Tipo | Nulabilidad | Descripción |
|---|---|---|---|
| `id_log` | `SERIAL` (PK) | `NOT NULL` | Identificador único. |
| `email_intentado` | `VARCHAR(100)` | `NOT NULL` | Email usado en el intento (puede no corresponder a ningún Personal real, si alguien prueba un correo inexistente). |
| `id_personal` | `INT` (FK → `personal.id_personal`, nullable) | `NULL` | Solo se llena si el email correspondía a un Personal real — permite loguear intentos con emails inventados sin romper integridad referencial. |
| `exitoso` | `BOOLEAN` | `NOT NULL` | Si el login tuvo éxito o no. |
| `motivo_fallo` | `VARCHAR(50)` | `NULL` | Ej. `credenciales_invalidas`, `cuenta_bloqueada`, `cuenta_baja` — solo si `exitoso = false`. |
| `fecha_intento` | `TIMESTAMP` | `NOT NULL`, default `now()` | Cuándo ocurrió. |

**Explícitamente NO se guarda:** la contraseña intentada, en ninguna
forma (ni texto plano ni hash) — no aporta valor de seguridad y sí
introduce riesgo.

### Mecanismo de escritura — mismo patrón que ADR-007
Como el login ocurre antes de que exista sesión con rol establecido,
la inserción en `log_acceso` necesita el mismo mecanismo que
`fn_login_lookup`: una función `SECURITY DEFINER` (o insertar desde
dentro de la misma función/flujo ya existente, ampliándola) — evaluar
con Claude Code cuál de las 2 opciones es más limpia:
(a) ampliar `fn_login_lookup` para que también inserte el log, o
(b) una función separada `fn_registrar_intento_login`, llamada desde el
mismo flujo de autenticación en el service de FastAPI.

### RLS
- Solo `admin` puede leer `log_acceso` — ni directivo ni docente.
- Sin políticas de INSERT vía API pública — solo la función
  `SECURITY DEFINER`/el service puede escribir.
- Inmutable — sin UPDATE/DELETE, igual que `Reporte_Incidencia`.

### Endpoint
`GET /log-acceso?id_personal=` (opcional, para ver el historial de una
persona específica) o `GET /log-acceso` (todos, con paginación —
esta tabla puede crecer más rápido que cualquier otra, cada intento de
login sea exitoso o no genera una fila).

### Frontend
- Sección "Historial de accesos" dentro del detalle de Personal
  (visible solo para admin), mostrando los últimos N intentos con
  fecha, resultado, y motivo si falló.
- Considerar alerta visual si hay múltiples intentos fallidos recientes
  para una cuenta (posible señal de intento de acceso indebido) — no es
  obligatorio para la primera versión, se puede agregar después.

---

## Endpoints nuevos/modificados — resumen

| Endpoint | Cambio |
|---|---|
| `PUT /personal/{id}/reset-password` | Nuevo |
| `PUT /personal/{id}` | Ampliar `PersonalUpdate.estatus` para aceptar `'bloqueado'` |
| `GET /log-acceso` | Nuevo, solo admin |
| (interno) `fn_login_lookup` o función nueva | Ampliar/crear para registrar cada intento |

---

## Decisiones resueltas

1. **`motivo_fallo`**: las 3 opciones (`credenciales_invalidas`,
   `cuenta_bloqueada`, `cuenta_baja`) son suficientes, confirmado — no
   se amplía el enum.
2. **Alertas automáticas**: NO se implementan. El log es un registro
   pasivo — el admin lo revisa manualmente cuando lo necesita, sin
   notificaciones proactivas por intentos fallidos repetidos. Puede
   agregarse en una iteración futura si se identifica la necesidad real.