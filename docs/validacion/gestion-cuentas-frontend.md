# Log de validación — Gestión de Cuentas (frontend)

**Fecha:** 2026-08-16
**Alcance:** frontend consumiendo el backend ya cerrado
(`docs/validacion/gestion-cuentas.md`, ADR-011) — reseteo de contraseña,
bloqueo temporal (incluye el toggle rápido de
Bloquear/Desbloquear en `PersonalListPage.tsx`, confirmado sin cambios
por el usuario) e historial de accesos, más el cierre del gap de Nivel 1
de la matriz RBAC en `PersonalEditPage.tsx`.

## Punto 1 — Verificación end-to-end del flujo completo (navegador real)

Con el stack de `docker-compose` (`db`/`app`) y `npm run dev` (Vite)
levantados, usando `claude-in-chrome`:

1. Admin (`admin@cobao.edu.mx`) resetea la contraseña de
   `docente@cobao.edu.mx` desde la sección "Restablecer contraseña" de
   `PersonalEditPage.tsx` — confirmación visual "Contraseña actualizada
   para Docente Seed." renderizada en pantalla.
2. El docente inicia sesión con la contraseña nueva desde una pestaña
   aparte — `200`, entra al dashboard.
3. Admin bloquea la misma cuenta con el toggle rápido "Bloquear" de
   `PersonalListPage.tsx` — anuncio "Docente Seed bloqueado.", badge de
   estatus cambia a "bloqueado", botón cambia a "Desbloquear".
4. El siguiente intento de login de esa cuenta falla —
   `{"detail":"Credenciales inválidas"}`, `401`.
5. "Historial de accesos" en `PersonalEditPage.tsx` (`GET
   /log-acceso?id_personal=`) refleja de inmediato ambos eventos, más
   reciente primero: el intento fallido ("Fallido" / "Cuenta bloqueada")
   arriba del login exitoso anterior ("Exitoso").

Cuenta de desarrollo restaurada (`estatus='activo'`,
contraseña `Docente123!`) después de la prueba, confirmado con `curl`
(`200` en `/auth/login`).

## Punto 2 — Gap de Nivel 1 (directivo en `PersonalEditPage.tsx`): encontrado, corregido, verificado

### El gap

La matriz RBAC (`docs/rbac/matriz-rbac-mvp.md`, Nivel 1) da a `directivo`
solo `R` sobre `Personal` (`admin` tiene `C, R, U, D`). Antes de esta
corrección, `PersonalEditPage.tsx` no tenía ningún gate de rol sobre el
formulario de edición en sí: `GET /personal` (usado para buscar el
registro por id, mismo patrón que `CalificacionCorrectPage`) responde
`200` tanto para `directivo` como para `admin`, así que un `directivo`
que navegara directo a `/personal/{id}/editar` veía el formulario
completo prellenado — nombre, rol, estatus, todo editable en la UI —
aunque cualquier intento de `Guardar` terminara en `403` real
(`PUT /personal/{id}` es `require_roles("admin")` en el backend). Antes
de agregar las secciones nuevas de Gestión de Cuentas (reset-password,
historial de accesos) este gap ya existía; se dejó documentado sin
corregir en el cierre anterior porque no era parte del alcance pedido en
ese momento.

### La corrección

`frontend/src/pages/PersonalEditPage.tsx`: se agregó un gate explícito
de rol en el cliente, mismo criterio que ya usan las 2 secciones nuevas
de Gestión de Cuentas (`esAdmin`, no solo el 403 del backend). Cuando
`listado`/`personal` ya cargaron y el viewer no es `admin`, se muestra
el mismo mensaje que ya usaba el error de envío
("No tienes permiso para editar personal.") en vez del formulario:

```tsx
{listado.loading || personal.loading ? (
  <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
) : listado.error ? (
  ...
) : !esAdmin ? (
  <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
    No tienes permiso para editar personal.
  </div>
) : notFound ? (
  ...
) : (
  <>...formulario...</>
)}
```

El check de `personal.loading` (agregado junto con el de `listado.loading`
en la misma condición de skeleton) evita un falso negativo: sin él, un
`admin` real vería un parpadeo del mensaje de "sin permiso" mientras
`GET /personal/me` todavía está en vuelo (esa consulta resuelve por
separado de `GET /personal`, con su propio `useApiQuery`).

### Verificación con evidencia real

Repetido dos veces por una condición de carrera real encontrada durante
esta misma verificación (ver nota abajo) — la evidencia que cuenta es la
segunda corrida, contra una base de datos de desarrollo limpia:

**`directivo` bloqueado, con evidencia de identidad real (no solo un
mensaje de error genérico):**

1. Login como `directivo@cobao.edu.mx` / `Directivo123!` → dashboard
   real con nav completo de directivo ("Personal", "Ciclo escolar",
   "Periodo semestral", "Análisis de alumno", "Grupos", "Asignaturas",
   "Asignaciones") y encabezado "Directivo Seed / Directivo" — confirma
   que la sesión es genuinamente `directivo`, no un token corrupto o de
   otro rol.
2. Navegación directa a `/personal/5/editar` (URL directa, no vía nav) →
   la tarjeta "Edición de personal" muestra únicamente
   "No tienes permiso para editar personal." — sin ningún campo del
   formulario, sin las secciones "Restablecer contraseña" ni "Historial
   de accesos".

**Regresión: `admin` sigue viendo el formulario completo, sin cambios:**

3. Login como `admin@cobao.edu.mx` / `Admin123!` → navegación directa a
   `/personal/5/editar` → formulario completo prellenado (Nombre
   "Docente", Apellido paterno "Seed", Rol "Docente", Estatus "Activo"),
   más las secciones "Restablecer contraseña" e "Historial de accesos"
   visibles debajo, exactamente como antes de este cambio.

### Nota operativa: condición de carrera real durante esta misma verificación

El primer intento de verificar el gap dio evidencia contaminada: la
suite completa de `pytest` (Punto 3) se lanzó en segundo plano contra la
misma base de datos que expone `docker-compose` en `127.0.0.1:5432`, y
`tests/conftest.py::seed` hace `TRUNCATE personal, ... CASCADE` al
inicio de cada test. Mientras esa suite corría, un login de `directivo`
en el navegador obtuvo un JWT válido para un `id_personal` que la suite
truncó milisegundos después — `GET /personal` (que no depende de leer la
fila propia) siguió devolviendo `200`, pero `GET /personal/me` (que sí
busca esa fila por id) empezó a devolver `404`, dejando `personal.data`
en `null` y la página cayendo en el mismo bloque de "sin permiso" por una
razón distinta a la que se quería probar (evidencia técnicamente
"correcta" en apariencia, pero no confiable). Se esperó a que la suite
en segundo plano terminara (confirmado con `197 passed`), se corrió
`db/seed_dev.py` de nuevo (idempotente) para restaurar las cuentas de
desarrollo, y se repitió la verificación completa desde cero — mismo
comportamiento ya documentado como nota operativa en
`docs/validacion/gestion-cuentas.md` (backend) y antes en
`docs/validacion/reporte-incidencia.md`.

## Punto 3 — Suites completas, sin regresiones

```
$ npm run build   # tsc -b && vite build
✓ built in ~500ms, sin errores de tipo

$ npm run lint    # oxlint
(sin salida, exit 0)

$ npm test        # vitest run
Test Files  3 passed (3)
     Tests  8 passed (8)

$ pytest -q       # suite completa de backend, Postgres real (sige_app)
197 passed, 3 warnings in 201.66s (0:03:21)
```

Sin regresiones: el conteo de 197 tests de backend coincide con el
cierre anterior (`docs/validacion/gestion-cuentas.md`), y ningún cambio
de este commit tocó código de backend — solo
`frontend/src/pages/PersonalEditPage.tsx`.

## Conclusión

Los 3 pendientes quedan cerrados:

1. Toggle rápido de Bloquear/Desbloquear en `PersonalListPage.tsx`:
   confirmado sin cambios por el usuario.
2. Gap de Nivel 1 (directivo viendo el formulario de edición de
   `Personal` pese a no tener `U` en la matriz RBAC): corregido con un
   gate explícito de rol en el cliente, verificado con evidencia real de
   identidad (dashboard con nav completo de directivo antes de navegar a
   la página bloqueada) contra una base de datos de desarrollo limpia, y
   sin regresión para `admin`.
3. Suite completa (backend 197 + frontend build/lint/test) en verde.

`frontend/src/pages/LoginPage.tsx` (badge de plantel + link "¿Olvidaste
tu contraseña?") sigue sin commitear, fuera de alcance a propósito —
pendiente para cuando el usuario lo pida explícitamente.
