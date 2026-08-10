import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { postCicloEscolar } from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 4 (POST /ciclo-escolar):
// X, A pueden dar de alta -- D nunca llega aquí vía nav, pero si entra por
// URL directa el 403 del submit se maneja igual (ver handleSubmit) y el
// nav de esta misma página tampoco le ofrece la entrada (buildNavItems).
export function CicloEscolarCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)

  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [activo, setActivo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const ciclo = await postCicloEscolar({
        nombre,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        activo,
      })
      setSuccess(`Ciclo escolar "${ciclo.nombre}" creado correctamente.`)
      setNombre('')
      setFechaInicio('')
      setFechaFin('')
      setActivo(false)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para crear ciclos escolares.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear el ciclo escolar.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/ciclo-escolar')}
      greetingSubtitle="Registra un nuevo ciclo escolar."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">
            Alta de ciclo escolar
          </h2>

          {/* Único punto de anuncio del resultado del submit (éxito o
              error), tal como pide la especificación -- "polite", no
              "assertive", para no interrumpir al lector de pantalla. */}
          <div aria-live="polite">
            {error && (
              <div className="mb-4 rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                {success}
              </div>
            )}
          </div>

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre">
                Nombre
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="nombre"
                maxLength={20}
                required
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_inicio">
                Fecha de inicio
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="fecha_inicio"
                required
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_fin">
                Fecha de fin
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="fecha_fin"
                required
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center">
              <input
                className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded bg-surface"
                id="activo"
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                disabled={isSubmitting}
              />
              <label className="ml-2 block font-label-md text-label-md text-on-surface-variant" htmlFor="activo">
                Activo
              </label>
            </div>

            <div className="pt-sm">
              <button
                className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </DashboardShell>
  )
}
