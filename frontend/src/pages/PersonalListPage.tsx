import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPersonal, getPersonalMe, type PersonalMe, type PersonalOut } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 9 (GET /personal):
// X, A pueden consultar (matriz RBAC Nivel 1: directivo solo R, sin
// crear/editar/dar de baja) -- el botón de alta (ficha 8) es admin
// únicamente, distinto del patrón de Ciclo/Periodo donde X y A comparten
// las mismas acciones.
export function PersonalListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const listado = useApiQuery<PersonalOut[]>(getPersonal)

  useEffect(() => {
    if (personal.unauthorized || listado.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, listado.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeCrear = personal.data?.rol === 'admin'
  const puedeEditar = personal.data?.rol === 'admin'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/personal')}
      greetingSubtitle="Consulta el personal del plantel."
      onLogout={handleLogout}
    >
      <section className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Personal</h2>
          {puedeCrear && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/personal/nuevo"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo personal
            </Link>
          )}
        </div>

        {listado.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{listado.error}</p>
          </div>
        ) : listado.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : listado.data && listado.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Correo</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Rol</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estatus</th>
                  {puedeEditar && <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />}
                </tr>
              </thead>
              <tbody>
                {listado.data.map((p) => (
                  <tr key={p.id_personal} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">
                      {p.nombre} {p.apellido_paterno} {p.apellido_materno ?? ''}
                    </td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{p.email_institucional}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface capitalize">{p.rol}</td>
                    <td className="p-4">
                      <span
                        className={
                          p.estatus === 'activo'
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                            : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-surface-container text-secondary'
                        }
                      >
                        {p.estatus}
                      </span>
                    </td>
                    {puedeEditar && (
                      <td className="p-4">
                        <Link
                          className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                          to={`/personal/${p.id_personal}/editar`}
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
          <p className="text-body-md font-body-md text-secondary">No hay personal registrado.</p>
        )}
      </section>
    </DashboardShell>
  )
}
