# CI de Fase 3 pendiente de confirmación — falla de dispatch de GitHub Actions

**Fecha:** 2026-08-06

Los commits de cierre de Fase 3 posteriores a `50cd272` (el que sí tiene
run verde, `31127657254`, ver `docs/validacion/fase-03-academico.md`) no
dispararon ningún run de CI:

- `04477a7` — Cierre de Fase 3 (doc de validación)
- `c125040` — CLAUDE.md: agrega ADR-007
- `a4d9fb8` — commit vacío, usado como prueba de control

Los tres están confirmados en `origin/main` (`git log origin/main`,
`git push --dry-run` → `Everything up-to-date`). El workflow `CI`
(`.github/workflows/ci.yml`, `id 323425065`) está `active`, con trigger
`on: push` sin filtros de rama ni de path, "Allow all actions" habilitado
en la configuración del repo, y la cuenta no es una organización (sin
policy adicional que pudiera bloquear). Verificado tanto por API
(`gh api .../actions/runs`, `total_count` sin cambios) como en la UI de
GitHub: cero runs para los tres commits, no solo ausentes de la vista por
paginación.

El commit vacío (`a4d9fb8`) fue la prueba decisiva: un commit trivial que
solo debía disparar el trigger `on: push` sin ningún otro efecto, y aun
así no generó ningún run, ni exitoso ni fallido ni en cola.

**Conclusión:** no es diagnosticable desde este repo — la configuración
está correcta en todos los puntos verificables (repo, permisos de
Actions, workflow, trigger). Es una falla de dispatch de GitHub Actions
externa al proyecto, coincidente con el `major_outage` reportado en
`githubstatus.com` para el componente Actions ese mismo día.

**No es bloqueante.** El código y los tests de Fase 3 ya están validados
con evidencia real (68 passed, local y en el run verde de `50cd272`) —
lo único pendiente es la confirmación de CI para estos 3 commits
puntuales, que puede quedar para cuando GitHub confirme el dispatch
restablecido. Fase 4 no depende de esto.
