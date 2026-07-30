# Log de validación RLS — rol `sige_app` (real, no ad-hoc)

**Fecha:** 2026-07-29
**Objetivo:** repetir la batería de RLS ya probada anteriormente con un rol
genérico (`app_test`), pero esta vez conectando con el rol real que usará
el backend en desarrollo/producción: `sige_app`, tal como quedó
provisionado por `db/init/01_create_app_role.sh` (ADR-006) y por los
`GRANT` explícitos de la migración de Alembic
`app/db/migrations/versions/7460fa835be8_initial_schema_from_ddl_mvp.py`.

> **Nota:** no existía un `docs/validacion/rls-test-log.md` previo — la
> primera corrida (con el rol `app_test`) se hizo con un script de
> scratchpad y sus resultados solo se reportaron en la conversación, sin
> persistirse a disco. Este es el primer log de validación RLS que queda
> versionado en el repo.

## Entorno

- `docker-compose up -d db` (Postgres 16, volumen limpio).
- Esquema aplicado con `alembic upgrade head` usando `DATABASE_URL_MIGRATIONS`
  (rol `sige_migrator`) — log completo de la migración: 40 sentencias de
  `db/ddl_mvp.sql` + los 2 `GRANT` a `sige_app`, sin errores.
- Datos semilla insertados como `sige_migrator` (bypassa RLS por ser owner,
  necesario para poblar sin depender de que ya existan filas de
  `Personal` con las que autenticar).
- Batería de pruebas ejecutada con `psql -U sige_app`, exactamente el
  mismo rol que usará `DATABASE_URL` en runtime.

## Confirmación de que `sige_app` es el rol real de producción/dev

```
--- atributos de rol sige_app (\du) ---
sige_app|

--- sige_app NO es owner de ninguna tabla ---
(vacio = confirmado, sige_migrator sigue siendo el owner de todo)
```

Sin atributos especiales (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
como se creó en `db/init/01_create_app_role.sh`) y sin ownership de
ninguna tabla — a diferencia de la corrida anterior con `postgres`
(superuser/owner), donde RLS se bypasseaba en silencio, aquí las
políticas sí tienen algo que restringir.

Privilegios otorgados a `sige_app` sobre cada tabla (via el `GRANT`
explícito de la migración de Alembic):

```
alembic_version|DELETE, INSERT, SELECT, UPDATE
alumno|DELETE, INSERT, SELECT, UPDATE
asignatura|DELETE, INSERT, SELECT, UPDATE
auditoria_calificacion|DELETE, INSERT, SELECT, UPDATE
calificacion|DELETE, INSERT, SELECT, UPDATE
ciclo_escolar|DELETE, INSERT, SELECT, UPDATE
expediente_academico|DELETE, INSERT, SELECT, UPDATE
grupo|DELETE, INSERT, SELECT, UPDATE
grupo_asignatura|DELETE, INSERT, SELECT, UPDATE
periodo_semestral|DELETE, INSERT, SELECT, UPDATE
personal|DELETE, INSERT, SELECT, UPDATE
plantel|DELETE, INSERT, SELECT, UPDATE
vw_grupo_num_alumnos|DELETE, INSERT, SELECT, UPDATE
vw_plantel_matricula_total|DELETE, INSERT, SELECT, UPDATE
```

**Nota menor:** el `GRANT ... ON ALL TABLES IN SCHEMA public` de la
migración también alcanzó a `alembic_version` (tabla de metadata de
Alembic, no de negocio) porque en ese momento del script ya existía en el
schema. No es un problema de seguridad — no contiene datos sensibles y el
backend nunca la consulta — pero es una concesión de la migración que vale
la pena anotar: si se quisiera excluirla, el `GRANT` tendría que listar
las 11 tablas de negocio por nombre en vez de usar `ALL TABLES`. No se
cambió porque no representa un riesgo real y `ALL TABLES` es más simple de
mantener a medida que se agreguen tablas futuras.

## Datos semilla (idénticos a la corrida anterior, para comparabilidad)

- 1 `plantel`, 1 `ciclo_escolar` activo, 1 `periodo_semestral` activo.
- `personal`: id 1 = doc1 (`docente`), id 2 = doc2 (`docente`),
  id 3 = dir1 (`directivo`), id 4 = admin1 (`admin`).
- `grupo`: id 1 = `1A`, id 2 = `1B`.
- `asignatura`: id 1 = `MAT1`, id 2 = `ESP1`.
- `grupo_asignatura`: id 1 = doc1/1A/MAT1, id 2 = doc2/1B/ESP1.
- `alumno`: id 1 = matrícula `MAT001` en grupo 1A, id 2 = matrícula
  `MAT002` en grupo 1B.
- `expediente_academico` para ambos alumnos.

## Resultados — 15/15 checks, conectado como `sige_app`

```
=== 1. Sin SET de variables de sesion: NO debe lanzar error (fix de current_setting) ===
0
PASS: SELECT personal sin session vars no lanza excepcion
PASS: SELECT personal sin session vars devuelve 0 filas (fail-closed)
PASS: INSERT personal sin session vars es rechazado (RLS deniega, no error de config)
  (rechazado correctamente por policy RLS, no por 'unrecognized configuration parameter')

=== 2. Docente (doc1, id=1) ve solo su propio registro de personal ===
PASS: docente ve solo su propio personal

=== 3. Docente ve solo sus propias grupo_asignatura ===
PASS: docente ve solo su grupo_asignatura

=== 4. Docente ve solo alumnos de sus grupos ===
PASS: docente ve solo alumno de su grupo

=== 5. Docente puede insertar calificacion en su propia grupo_asignatura ===
PASS: docente inserta calificacion en su propio grupo_asignatura

=== 6. Docente NO puede insertar calificacion en grupo_asignatura ajena ===
PASS: docente NO inserta calificacion en grupo_asignatura ajena

=== 7. Docente NO puede insertar en Personal (solo admin) ===
PASS: docente NO inserta en personal

=== 8. Directivo ve TODO el personal del plantel ===
PASS: directivo ve los 4 registros de personal

=== 9. Directivo NO puede insertar en Personal (solo admin) ===
PASS: directivo NO inserta en personal

=== 10. Admin SI puede insertar en Personal ===
PASS: admin inserta en personal exitosamente

=== 11. Directivo puede corregir (UPDATE) calificacion capturada por un docente (ADR-004) ===
PASS: directivo corrige calificacion de un docente

=== 12. Auditoria: docente NO puede leer; directivo SI ===
PASS: docente ve 0 filas de auditoria
PASS: directivo query de auditoria no falla

================================
RESULTADOS: 15 passed, 0 failed
```

## Conclusión

Con el rol real (`sige_app`, sin privilegios de owner/superuser, tal como
lo configura ADR-006 y lo provisiona `db/init/01_create_app_role.sh` +
la migración de Alembic), las 15 verificaciones contra la matriz RBAC
(`docs/rbac/matriz-rbac-mvp.md`) pasan de forma idéntica a la corrida
anterior con el rol de prueba `app_test`. Esto confirma que la
configuración de producción/desarrollo — no solo un rol ad-hoc — hace
cumplir RLS correctamente: fail-closed sin variables de sesión, scope
correcto por rol (docente/directivo/admin), y las reglas de negocio
específicas (ADR-004: directivo corrige calificaciones de un docente).

Entorno de prueba limpiado al finalizar (`docker-compose down -v`, `.env`
de prueba eliminado).
