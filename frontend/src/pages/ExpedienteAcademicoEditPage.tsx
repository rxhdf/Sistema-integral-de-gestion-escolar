import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getExpedienteAcademico, putExpedienteAcademico, type ExpedienteAcademicoOut } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

type SituacionAcademica = 'regular' | 'irregular' | 'condicionado'

// docs/frontend/02-especificacion-contenido.md, ficha 29
// (PUT /expediente-academico/{id_alumno}): X, A. Sin riesgo de 409 (sin
// UNIQUE en los campos editables). promedio_actual normalmente lo
// recalcula el backend vía fn_actualizar_promedio_actual al capturar una
// calificación -- editarlo aquí lo sobrescribe hasta la siguiente
// captura, de ahí la advertencia visible en el formulario.
export function ExpedienteAcademicoEditPage() {
  const navigate = useNavigate()
  const { idAlumno } = useParams<{ idAlumno: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const fetchExpediente = useCallback(() => getExpedienteAcademico(Number(idAlumno)), [idAlumno])
  const expediente = useApiQuery<ExpedienteAcademicoOut>(fetchExpediente)

  const [escuelaProcedencia, setEscuelaProcedencia] = useState('')
  const [promedioSecundaria, setPromedioSecundaria] = useState('')
  const [promedioActual, setPromedioActual] = useState('')
  const [situacionAcademica, setSituacionAcademica] = useState<SituacionAcademica>('regular')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || expediente.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (expediente.data && !initialized) {
      setEscuelaProcedencia(expediente.data.escuela_procedencia ?? '')
      setPromedioSecundaria(expediente.data.promedio_secundaria?.toString() ?? '')
      setPromedioActual(expediente.data.promedio_actual?.toString() ?? '')
      setSituacionAcademica(expediente.data.situacion_academica)
      setInitialized(true)
    }
  }, [personal.unauthorized, expediente.unauthorized, expediente.data, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idAlumno) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      await putExpedienteAcademico(Number(idAlumno), {
        escuela_procedencia: escuelaProcedencia || null,
        promedio_secundaria: promedioSecundaria ? Number(promedioSecundaria) : null,
        promedio_actual: promedioActual ? Number(promedioActual) : null,
        situacion_academica: situacionAcademica,
      })
      setSuccess('Expediente académico actualizado correctamente.')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar expedientes académicos.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar el expediente académico.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Edita el expediente académico de un alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Edición de expediente académico</h2>

          {expediente.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : expediente.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {expediente.error}
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

              <p className="mb-4 rounded-md border border-outline-variant bg-surface-container px-sm py-sm font-body-sm text-body-sm text-secondary">
                El promedio actual normalmente lo recalcula el sistema al capturar una calificación. Editarlo aquí lo
                sobrescribe hasta la siguiente captura.
              </p>

              <form className="space-y-md" onSubmit={handleSubmit}>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="escuela_procedencia">
                    Escuela de procedencia
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="escuela_procedencia"
                    maxLength={200}
                    type="text"
                    value={escuelaProcedencia}
                    onChange={(e) => setEscuelaProcedencia(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="promedio_secundaria">
                    Promedio de secundaria
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="promedio_secundaria"
                    min={0}
                    max={10}
                    step={0.1}
                    type="number"
                    value={promedioSecundaria}
                    onChange={(e) => setPromedioSecundaria(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="promedio_actual">
                    Promedio actual
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="promedio_actual"
                    min={0}
                    max={10}
                    step={0.1}
                    type="number"
                    value={promedioActual}
                    onChange={(e) => setPromedioActual(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="situacion_academica">
                    Situación académica
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="situacion_academica"
                    value={situacionAcademica}
                    onChange={(e) => setSituacionAcademica(e.target.value as SituacionAcademica)}
                    disabled={isSubmitting}
                  >
                    <option value="regular">Regular</option>
                    <option value="irregular">Irregular</option>
                    <option value="condicionado">Condicionado</option>
                  </select>
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
