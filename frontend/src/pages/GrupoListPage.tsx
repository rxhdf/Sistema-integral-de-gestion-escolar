import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGrupos, type GrupoOut } from '@/api/academico'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 10 (GET /grupo):
// D, X, A pueden consultar -- el botón de alta (ficha 11) solo se ofrece a
// X, A (RBAC Nivel 1: docente solo R en las 3 entidades de Flujo 3).
export function GrupoListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const grupos = useApiQuery<GrupoOut[]>(getGrupos)

  useEffect(() => {
    if (personal.unauthorized || grupos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, grupos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeCrear = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/grupo')}
      greetingSubtitle="Consulta los grupos registrados."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Grupos</h2>
          {puedeCrear && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/grupo/nuevo"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo grupo
            </Link>
          )}
        </div>

        {grupos.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{grupos.error}</p>
          </div>
        ) : grupos.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : grupos.data && grupos.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Semestre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Capacidad máxima</th>
                  {puedeCrear && <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />}
                </tr>
              </thead>
              <tbody>
                {grupos.data.map((g) => (
                  <tr key={g.id_grupo} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{g.nombre_grupo}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{g.semestre}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{g.capacidad_maxima ?? '—'}</td>
                    {puedeCrear && (
                      <td className="p-4">
                        <Link
                          className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                          to={`/grupo/${g.id_grupo}/editar`}
                        >
                          Editar
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Aún no hay grupos registrados.</p>
        )}
      </section>
    </DashboardShell>
  )
}
