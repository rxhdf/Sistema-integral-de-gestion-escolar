import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAsignaturas, type AsignaturaOut } from '@/api/academico'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 12 (GET /asignatura):
// D, X, A pueden consultar -- el botón de alta (ficha 13) solo se ofrece a
// X, A (RBAC Nivel 1: docente solo R en las 3 entidades de Flujo 3).
export function AsignaturaListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const asignaturas = useApiQuery<AsignaturaOut[]>(getAsignaturas)

  useEffect(() => {
    if (personal.unauthorized || asignaturas.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, asignaturas.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeCrear = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/asignatura')}
      greetingSubtitle="Consulta el catálogo de asignaturas."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Asignaturas</h2>
          {puedeCrear && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/asignatura/nueva"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nueva asignatura
            </Link>
          )}
        </div>

        {asignaturas.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{asignaturas.error}</p>
          </div>
        ) : asignaturas.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : asignaturas.data && asignaturas.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Clave</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Semestre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {asignaturas.data.map((a) => (
                  <tr key={a.id_asignatura} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{a.clave_asignatura}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{a.nombre}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{a.semestre}</td>
                    <td className="p-4">
                      <span
                        className={
                          a.activa
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                            : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-surface-container text-secondary'
                        }
                      >
                        {a.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Aún no hay asignaturas registradas.</p>
        )}
      </section>
    </DashboardShell>
  )
}
