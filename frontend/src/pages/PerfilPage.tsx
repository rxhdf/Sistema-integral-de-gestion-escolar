import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPersonalMeFull, type PersonalOut } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 2 (GET /personal/me):
// D, X, A -- cada quien su propio registro. Solo lectura; la edición del
// propio registro no existe aquí (solo admin edita vía ficha 24, ver
// PersonalEditPage). Reordenada primero en la tanda de cierre por
// Congruencia -- ver la nota en docs/frontend/01-priorizacion-flujos.md
// sobre por qué su posición global #2 (Bloqueo) ya no aplica.
export function PerfilPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalOut>(getPersonalMeFull)

  useEffect(() => {
    if (personal.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/perfil')}
      greetingSubtitle="Consulta tu información de personal."
      onLogout={handleLogout}
    >
      <section className="max-w-xl space-y-4">
        <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Mi perfil</h2>

        {personal.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar tu perfil</p>
            <p className="font-body-md text-body-md">{personal.error}</p>
          </div>
        ) : personal.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-10 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : personal.data ? (
          <dl className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 space-y-4">
            <div>
              <dt className="font-label-md text-label-md text-secondary">Nombre</dt>
              <dd className="font-body-lg text-body-lg text-on-surface">
                {personal.data.nombre} {personal.data.apellido_paterno} {personal.data.apellido_materno ?? ''}
              </dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-secondary">CURP</dt>
              <dd className="font-body-lg text-body-lg text-on-surface">{personal.data.curp}</dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-secondary">Correo institucional</dt>
              <dd className="font-body-lg text-body-lg text-on-surface">{personal.data.email_institucional}</dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-secondary">Rol</dt>
              <dd className="font-body-lg text-body-lg text-on-surface capitalize">{personal.data.rol}</dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-secondary">Teléfono</dt>
              <dd className="font-body-lg text-body-lg text-on-surface">{personal.data.telefono ?? 'Sin capturar'}</dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-secondary">Fecha de ingreso</dt>
              <dd className="font-body-lg text-body-lg text-on-surface">
                {personal.data.fecha_ingreso ?? 'Sin capturar'}
              </dd>
            </div>
            <div>
              <dt className="font-label-md text-label-md text-secondary">Estatus</dt>
              <dd className="font-body-lg text-body-lg text-on-surface capitalize">{personal.data.estatus}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </DashboardShell>
  )
}
