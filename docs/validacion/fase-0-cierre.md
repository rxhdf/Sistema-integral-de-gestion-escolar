# Cierre de Fase 0 — SIGE

**Fecha:** 2026-07-30
**Estado:** Fase 0 cerrada. Habilita el arranque de Fase 2 (primer slice
vertical: Organizacional + Personal + Auth).

Este documento confirma, con evidencia real (no simulada), los 4 puntos
del gate de cierre de Fase 0.

## Evidencia: run verde en GitHub Actions

- Repo: `rxhdf/Sistema-integral-de-gestion-escolar`
- Run: [`30511093722`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/30511093722)
- Commit: `27e2668` — "Corrige punto 2 del workflow"
- Job `fase0-gate`: **success**, 30s
- Única anotación: warning de deprecación de Node 20 en `actions/checkout@v4`
  (infraestructura de GitHub, no relacionado con la app — no es una falla).

Obtenido directamente vía `gh run view --job=90771185905 --log` contra el
repo real, no reconstruido de memoria.

### Historial de esta corrida (transparencia)

El primer push (`55b0444`, "Estructura simple") **falló** en el punto 2 con
`invalid container name or ID: value is empty`. Causa raíz: `docker compose
ps` (v2, el CLI real de los runners de GitHub Actions) oculta por defecto
los contenedores que ya terminaron — igual que `docker ps` sin `-a` — y
`migrate` termina con exit 0 por diseño (es un job de una sola pasada, no
un servicio de larga duración). Sin `-a`, `docker compose ps -q migrate`
devolvía vacío y el `docker inspect` posterior fallaba.

Esto no se detectó en la simulación local previa porque el único CLI
disponible en ese entorno era `docker-compose` v1.29.2 (standalone), cuyo
comportamiento de filtrado difiere del plugin `docker compose` v2 que usan
los runners de GitHub — una limitación real de la simulación local, no un
error de lógica del workflow en sí. Se corrigió agregando `-a`/`--all` y
una guarda explícita (`test -n "$container_id"`) en
`.github/workflows/ci.yml`. El segundo push (`27e2668`) corrió limpio.

## Punto 1 — Postgres levanta con los 2 roles de ADR-006

```
sige_app|
sige_migrator|Superuser, Create role, Create DB, Replication, Bypass RLS
```

`sige_migrator` (owner, creado vía `POSTGRES_USER`) y `sige_app` (rol de
runtime, sin atributos especiales — `NOSUPERUSER NOCREATEDB NOCREATEROLE
NOREPLICATION`, creado por `db/init/01_create_app_role.sh`), tal como
especifica `docs/decisions/ADR-006.md`.

## Punto 2 — la migración de Alembic aplica limpio

```
exit code de migrate: 0
```

El servicio `migrate` de `docker-compose.yml` corre `alembic upgrade head`
con `DATABASE_URL_MIGRATIONS` (rol `sige_migrator`) contra un volumen de
Postgres limpio, aplica las 40 sentencias de `db/ddl_mvp.sql` + los GRANT
a `sige_app`, y termina con exit 0. `app` espera explícitamente a que este
paso termine (`depends_on: migrate: condition: service_completed_successfully`)
antes de arrancar.

## Punto 3 — GET /health responde 200 con conexión real a BD

```
http status: 200
{"status":"ok","db":"connected"}
```

`app/main.py` expone `GET /health` sin autenticación ni lógica de negocio:
abre una conexión con `DATABASE_URL` (rol `sige_app`, el mismo que usará
el backend en runtime) y ejecuta `SELECT 1`. La respuesta 200 confirma
conectividad real a Postgres con el rol de producción/desarrollo, no con
un rol de prueba.

## Punto 4 — el pipeline de CI pasa en verde

Confirmado arriba: run `30511093722` en GitHub Actions, `fase0-gate`
success. No es una simulación local — es la corrida real contra el
repositorio remoto (`git push` del usuario, ejecutado por
`.github/workflows/ci.yml`).

## Qué queda fuera de Fase 0 (a propósito)

- Alembic sigue usando migraciones "manuales" (traduce `db/ddl_mvp.sql`
  sentencia por sentencia) — no hay modelos ORM ni soporte de
  `--autogenerate` todavía. Eso arranca en Fase 2 junto con los dominios
  `organizacional` y `personal`.
- No hay autenticación, JWT, ni lógica de negocio — `GET /health` es
  intencionalmente el único endpoint.
- `app/domains/*` sigue siendo estructura vacía (`__init__.py` +
  archivos placeholder), tal como se dejó en la Fase 0 de estructura.

## Conclusión

Los 4 puntos del gate están confirmados con evidencia real: Postgres con
separación de roles (ADR-006), migración de Alembic aplicando limpio,
`/health` confirmando conexión con el rol de runtime real (`sige_app`), y
CI en verde en GitHub Actions contra el repositorio remoto. **Fase 0
formalmente cerrada** — Fase 2 (Organizacional + Personal + Auth) puede
arrancar.
