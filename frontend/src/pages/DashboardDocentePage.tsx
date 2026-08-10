import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGrupoAsignaturas, getGrupos, getAsignaturas } from '@/api/academico'
import { getAlumnos } from '@/api/alumnos'
import { getCalificaciones } from '@/api/calificaciones'
import type { DashboardDocenteOut } from '@/api/dashboard'
import type { PersonalMe } from '@/api/personal'
import { DashboardShell } from '@/components/DashboardShell'
import { KpiCard } from '@/components/KpiCard'
import { buildMisGrupos } from '@/lib/misGrupos'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface DashboardDocentePageProps {
  resumen: DashboardDocenteOut
  personal: PersonalMe | null
  onLogout: () => void
}

async function fetchMisGruposData() {
  const [grupoAsignaturas, grupos, asignaturas, alumnos, calificaciones] = await Promise.all([
    getGrupoAsignaturas(),
    getGrupos(),
    getAsignaturas(),
    getAlumnos(),
    getCalificaciones(),
  ])
  return buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, calificaciones)
}

export function DashboardDocentePage({ resumen, personal, onLogout }: DashboardDocentePageProps) {
  const navigate = useNavigate()
  const misGrupos = useApiQuery(fetchMisGruposData)

  useEffect(() => {
    if (misGrupos.unauthorized) navigate('/login', { replace: true })
  }, [misGrupos.unauthorized, navigate])

  const sinGrupos = resumen.numero_grupos_asignados === 0

  const kpis = [
    { icon: 'group', label: 'Grupos Asignados', value: resumen.numero_grupos_asignados },
    { icon: 'school', label: 'Alumnos a mi Cargo', value: resumen.numero_alumnos_bajo_responsabilidad },
    { icon: 'grading', label: 'Calificaciones Pendientes', value: resumen.calificaciones_pendientes },
  ]

  return (
    <DashboardShell
      personal={personal}
      navItems={buildNavItems(personal?.rol, '/dashboard')}
      greetingSubtitle="Aquí está el resumen de tus grupos para hoy."
      onLogout={onLogout}
    >
      {sinGrupos ? (
        <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-secondary text-4xl mb-2">groups_off</span>
          <p className="text-body-lg font-body-lg font-bold text-on-surface">Aún no tienes grupos asignados.</p>
          <p className="text-body-md font-body-md text-secondary mt-1">
            Cuando un directivo o administrador te asigne a un grupo, aparecerá aquí.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-headline-md font-headline-md font-bold text-on-surface border-b border-surface-variant pb-2">
          Acceso Rápido
        </h2>
        <Link
          className="w-full flex items-center gap-4 p-6 bg-primary text-on-primary rounded-xl hover:bg-on-primary-fixed-variant transition-colors text-left"
          to="/calificacion/nueva"
        >
          <div className="p-3 bg-on-primary/10 rounded-full">
            <span className="material-symbols-outlined text-3xl">edit_note</span>
          </div>
          <div>
            <h3 className="text-body-lg font-body-lg font-bold">Capturar calificaciones</h3>
            <p className="text-label-md font-label-md opacity-90">
              Registra los parciales de tus alumnos
            </p>
          </div>
        </Link>
      </section>

      <section className="space-y-6">
        <h2 className="text-headline-md font-headline-md font-bold text-on-surface border-b border-surface-variant pb-2">
          Mis grupos
        </h2>
        {misGrupos.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudieron cargar tus grupos</p>
            <p className="font-body-md text-body-md">{misGrupos.error}</p>
          </div>
        ) : misGrupos.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-16 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : misGrupos.data && misGrupos.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Grupo</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Asignatura</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Alumnos</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Calificaciones</th>
                </tr>
              </thead>
              <tbody>
                {misGrupos.data.map((grupo) => (
                  <tr key={grupo.id_grupo_asig} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{grupo.nombreGrupo}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{grupo.nombreAsignatura}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{grupo.numAlumnos}</td>
                    <td className="p-4">
                      <span
                        className={
                          grupo.tienePendientes
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-amber-100 text-amber-800'
                            : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                        }
                      >
                        {grupo.tienePendientes ? 'Pendientes' : 'Al corriente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !sinGrupos && (
            <p className="text-body-md font-body-md text-secondary">No se encontraron grupos.</p>
          )
        )}
      </section>
    </DashboardShell>
  )
}
