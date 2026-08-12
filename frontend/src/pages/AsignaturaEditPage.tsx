import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAsignaturas, putAsignatura, type AsignaturaOut } from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 26 (PUT /asignatura/{id}):
// X, A. clave_asignatura no es editable aquí (no está en AsignaturaUpdate) --
// sin riesgo de 409, la única UNIQUE de la entidad no se toca desde este
// formulario.
export function AsignaturaEditPage() {
  const navigate = useNavigate()
  const { idAsignatura } = useParams<{ idAsignatura: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const listado = useApiQuery<AsignaturaOut[]>(getAsignaturas)

  const [nombre, setNombre] = useState('')
  const [semestre, setSemestre] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [activa, setActiva] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const asignatura = listado.data?.find((a) => a.id_asignatura === Number(idAsignatura))

  useEffect(() => {
    if (personal.unauthorized || listado.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (listado.data && !initialized) {
      if (!asignatura) {
        setNotFound(true)
      } else {
        setNombre(asignatura.nombre)
        setSemestre(asignatura.semestre)
        setActiva(asignatura.activa)
      }
      setInitialized(true)
    }
  }, [personal.unauthorized, listado.unauthorized, listado.data, asignatura, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idAsignatura) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const actualizada = await putAsignatura(Number(idAsignatura), { nombre, semestre, activa })
      setSuccess(`Asignatura "${actualizada.nombre}" actualizada correctamente.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar asignaturas.')
      } else if (err instanceof ApiError && err.message.includes('no encontrada')) {
        setNotFound(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar la asignatura.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/asignatura')}
      greetingSubtitle="Edita una asignatura."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Edición de asignatura</h2>

          {listado.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : listado.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {listado.error}
            </div>
          ) : notFound ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Asignatura no encontrada.
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>
    </DashboardShell>
  )
}
