import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, UnauthorizedError } from '@/api/client'
import { getCalificaciones, putCalificacion, type CalificacionOut } from '@/api/calificaciones'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 23 (PUT /calificacion/{id}):
// D (solo lo suyo), X, A (todo el plantel, ADR-004). No hay GET /calificacion/{id}
// -- se busca la fila en el listado ya filtrado por RLS (GET /calificacion);
// si un docente entra por URL directa a una calificación fuera de su scope,
// simplemente no aparece en su propio listado -- mismo 404 de opacidad que
// aplica el backend, sin necesidad de que el PUT lo revele primero.
export function CalificacionCorrectPage() {
  const navigate = useNavigate()
  const { idCalificacion } = useParams<{ idCalificacion: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const listado = useApiQuery<CalificacionOut[]>(getCalificaciones)

  const [parcial1, setParcial1] = useState('')
  const [parcial2, setParcial2] = useState('')
  const [parcial3, setParcial3] = useState('')
  const [tipoEvaluacion, setTipoEvaluacion] = useState<'ordinaria' | 'extraordinaria'>('ordinaria')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [resultado, setResultado] = useState<CalificacionOut | null>(null)

  const calificacion = listado.data?.find((c) => c.id_calificacion === Number(idCalificacion))

  useEffect(() => {
    if (personal.unauthorized || listado.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (listado.data && !initialized) {
      if (!calificacion) {
        setNotFound(true)
      } else {
        setParcial1(calificacion.parcial_1?.toString() ?? '')
        setParcial2(calificacion.parcial_2?.toString() ?? '')
        setParcial3(calificacion.parcial_3?.toString() ?? '')
        setTipoEvaluacion(calificacion.tipo_evaluacion)
      }
      setInitialized(true)
    }
  }, [personal.unauthorized, listado.unauthorized, listado.data, calificacion, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idCalificacion) return
    setError(null)
    setResultado(null)
    setIsSubmitting(true)
    try {
      const actualizado = await putCalificacion(Number(idCalificacion), {
        parcial_1: parcial1 === '' ? null : Number(parcial1),
        parcial_2: parcial2 === '' ? null : Number(parcial2),
        parcial_3: parcial3 === '' ? null : Number(parcial3),
        tipo_evaluacion: tipoEvaluacion,
      })
      setResultado(actualizado)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ApiError && err.message.includes('no encontrada')) {
        setNotFound(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo corregir la calificación.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/calificacion')}
      greetingSubtitle="Corrige los parciales de una calificación ya capturada."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Corrección de calificación</h2>

          {listado.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : listado.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {listado.error}
            </div>
          ) : notFound ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Calificación no encontrada.
            </div>
          ) : (
            <>
              {/* Afecta una calificación ya oficial, potencialmente
                  capturada por otra persona si corrige X/A -- assertive
                  (ficha 23). */}
              <div aria-live="assertive">
                {error && (
                  <div className="mb-4 rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                    {error}
                  </div>
                )}
                {resultado && (
                  <div className="mb-4 rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                    Corrección guardada. Final: {resultado.calificacion_final ?? '—'} ({resultado.estatus}).
                  </div>
                )}
              </div>

              <form className="space-y-md" onSubmit={handleSubmit}>
                <div className="grid grid-cols-3 gap-sm">
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface block" htmlFor="parcial_1">
                      Parcial 1
                    </label>
                    <input
                      className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                      id="parcial_1"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={parcial1}
                      onChange={(e) => setParcial1(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface block" htmlFor="parcial_2">
                      Parcial 2
                    </label>
                    <input
                      className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                      id="parcial_2"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={parcial2}
                      onChange={(e) => setParcial2(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface block" htmlFor="parcial_3">
                      Parcial 3
                    </label>
                    <input
                      className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                      id="parcial_3"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={parcial3}
                      onChange={(e) => setParcial3(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="tipo_evaluacion">
                    Tipo de evaluación
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                    id="tipo_evaluacion"
                    value={tipoEvaluacion}
                    onChange={(e) => setTipoEvaluacion(e.target.value as 'ordinaria' | 'extraordinaria')}
                    disabled={isSubmitting}
                  >
                    <option value="ordinaria">Ordinaria</option>
                    <option value="extraordinaria">Extraordinaria</option>
                  </select>
                </div>

                <div className="pt-sm">
                  <button
                    className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Guardando…' : 'Guardar corrección'}
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
