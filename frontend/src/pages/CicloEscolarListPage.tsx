import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCiclosEscolares, type CicloEscolarOut } from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 3 (GET /ciclo-escolar):
// D, X, A pueden consultar -- el botón de alta (ficha 4) solo se ofrece a X, A.
// El nav, sin embargo, sigue la política ya fijada en buildNavItems: la
// sección "Ciclo escolar" no se le ofrece a docente aunque el backend le
// permita leerla (docente puede llegar por URL directa sin problema, solo
// no se le tienta desde la navegación).
export function CicloEscolarListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const ciclos = useApiQuery<CicloEscolarOut[]>(getCiclosEscolares)

  useEffect(() => {
    if (personal.unauthorized || ciclos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, ciclos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeCrear = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/ciclo-escolar')}
      greetingSubtitle="Consulta los ciclos escolares registrados."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Ciclos escolares</h2>
          {puedeCrear && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/ciclo-escolar/nuevo"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo ciclo escolar
            </Link>
          )}
        </div>

        {ciclos.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{ciclos.error}</p>
          </div>
        ) : ciclos.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : ciclos.data && ciclos.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Inicio</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Fin</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ciclos.data.map((ciclo) => (
                  <tr key={ciclo.id_ciclo} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{ciclo.nombre}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{ciclo.fecha_inicio}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{ciclo.fecha_fin}</td>
                    <td className="p-4">
                      <span
                        className={
                          ciclo.activo
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                            : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-surface-container text-secondary'
                        }
                      >
                        {ciclo.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Aún no hay ciclos escolares registrados.</p>
        )}
      </section>
    </DashboardShell>
  )
}
