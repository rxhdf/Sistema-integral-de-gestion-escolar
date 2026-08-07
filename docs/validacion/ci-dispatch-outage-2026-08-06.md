# CI de Fase 3 pendiente de confirmación — falla de dispatch de GitHub Actions

**Fecha:** 2026-08-06
**Estado: RESUELTO el 2026-08-07.** Ver "Resolución" al final de este
documento — GitHub confirmó todos los sistemas operacionales en
`status.github.com`, y un commit posterior (`5300b44`) ya tiene run
verde cubriendo el código de todos los commits afectados. No hay
pendiente de CI abierto.

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

## Resolución (2026-08-07)

GitHub confirmó todos los sistemas operacionales en `status.github.com`.
Verificación antes de dar por cerrado (sin pushear nada nuevo primero):

```
gh run list --repo rxhdf/Sistema-integral-de-gestion-escolar --limit 20
```

**Los commits pusheados durante la ventana del outage nunca dispararon
run, ni siquiera después de la recuperación — confirmado permanente, no
retroactivo.** Lista completa de commits sin run, nunca:

- `04477a7` — Cierre de Fase 3 (doc de validación)
- `c125040` — CLAUDE.md: agrega ADR-007
- `a4d9fb8` — commit vacío (prueba de control original)
- `bdf01b9` — docs: nota corta sobre la falla de dispatch (este mismo doc)
- `b3bdc72` — Fase 4: Alumnos y expedientes (Alumno, Expediente_Academico)

Esto confirma la hipótesis: esos 5 commits quedaron permanentemente
fuera del dispatch durante el incidente, sin reintento retroactivo por
parte de GitHub.

**No fue necesario un commit vacío nuevo.** El siguiente commit después
de la ventana perdida, `5300b44` ("Cierre de Fase 4: corrige RLS de
expediente_academico + evidencia"), sí disparó run —
[`31133057823`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/31133057823),
**success**. Como `5300b44` es descendiente directo de los 5 commits
perdidos, su árbol de archivos ya incluye acumulativamente todo el
código que esos 5 commits introdujeron — el contenido de esos commits sí
quedó validado por CI, aunque no de forma individual por commit.

**Confirmación final, sin discrepancias con la validación local**: el
run del commit `HEAD` actual (`8d77d13`, "Cierre consolidado de Fase 5")
—
[`31137042423`](https://github.com/rxhdf/Sistema-integral-de-gestion-escolar/actions/runs/31137042423),
**success**, `head_sha` confirmado igual a `origin/main` — corrió la
suite completa en el runner de GitHub:

```
================== 135 passed, 1 warning in 162.78s (0:02:42) ==================
```

Mismo resultado exacto (**135 passed**) que la corrida local documentada
en `docs/validacion/fase-05-calificaciones.md` (131.32s local vs. 162.78s
en el runner — diferencia de tiempo esperable, sin diferencia de
resultado). Todos los commits desde `5300b44` en adelante tienen run
verde propio — ver `gh run list` arriba.

**Cierre**: la falla de dispatch fue real, externa, y confirmada por
`githubstatus.com` (`major_outage` en el componente Actions). Cinco
commits puntuales quedaron sin run individual de forma permanente, pero
su código está completamente cubierto por el run verde de `5300b44` en
adelante. No queda ningún pendiente de CI abierto en este proyecto.
