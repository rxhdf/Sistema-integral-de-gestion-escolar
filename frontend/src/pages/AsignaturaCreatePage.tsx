import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { postAsignatura } from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 13 (POST /asignatura):
// X, A pueden dar de alta -- D nunca llega aquí vía nav, pero si entra por
// URL directa el 403 del submit se maneja igual (ver handleSubmit).
export function AsignaturaCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)

  const [claveAsignatura, setClaveAsignatura] = useState('')
  const [nombre, setNombre] = useState('')
  const [semestre, setSemestre] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [activa, setActiva] = useState(true)
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
      const asignatura = await postAsignatura({
        clave_asignatura: claveAsignatura,
        nombre,
        semestre,
        activa,
      })
      setSuccess(`Asignatura "${asignatura.nombre}" creada correctamente.`)
      setClaveAsignatura('')
      setNombre('')
      setSemestre(1)
      setActiva(true)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para crear asignaturas.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear la asignatura.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/asignatura')}
      greetingSubtitle="Registra una nueva asignatura en el catálogo."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Alta de asignatura</h2>

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
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="clave_asignatura">
                Clave
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="clave_asignatura"
                maxLength={20}
                required
                type="text"
                value={claveAsignatura}
                onChange={(e) => setClaveAsignatura(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre">
                Nombre
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="nombre"
                maxLength={120}
                required
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="semestre">
                Semestre
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="semestre"
                required
                value={semestre}
                onChange={(e) => setSemestre(Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6)}
                disabled={isSubmitting}
              >
                {[1, 2, 3, 4, 5, 6].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded bg-surface"
                id="activa"
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
                disabled={isSubmitting}
              />
              <label className="ml-2 block font-label-md text-label-md text-on-surface-variant" htmlFor="activa">
                Activa
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
