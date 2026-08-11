import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAlumnos, postExpedienteAcademico, type AlumnoOut } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

type SituacionAcademica = 'regular' | 'irregular' | 'condicionado'

// docs/frontend/02-especificacion-contenido.md, ficha 19
// (POST /expediente-academico): X, A dan de alta. id_alumno viene de un
// selector -- acepta ?id_alumno= como prefill cuando se llega desde "Ver
// expediente" de un alumno que aún no tiene uno (ver
// ExpedienteAcademicoDetailPage).
export function ExpedienteAcademicoCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const alumnos = useApiQuery<AlumnoOut[]>(getAlumnos)

  const [idAlumno, setIdAlumno] = useState(searchParams.get('id_alumno') ?? '')
  const [escuelaProcedencia, setEscuelaProcedencia] = useState('')
  const [promedioSecundaria, setPromedioSecundaria] = useState('')
  const [promedioActual, setPromedioActual] = useState('')
  const [situacionAcademica, setSituacionAcademica] = useState<SituacionAcademica>('regular')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || alumnos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, alumnos.unauthorized, navigate])

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
      const expediente = await postExpedienteAcademico({
        id_alumno: Number(idAlumno),
        escuela_procedencia: escuelaProcedencia || null,
        promedio_secundaria: promedioSecundaria ? Number(promedioSecundaria) : null,
        promedio_actual: promedioActual ? Number(promedioActual) : null,
        situacion_academica: situacionAcademica,
      })
      setSuccess(`Expediente académico #${expediente.id_exp_academico} creado correctamente.`)
      setIdAlumno('')
      setEscuelaProcedencia('')
      setPromedioSecundaria('')
      setPromedioActual('')
      setSituacionAcademica('regular')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para crear expedientes académicos.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear el expediente académico.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Registra el expediente académico de un alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Alta de expediente académico</h2>

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
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_alumno">
                Alumno
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="id_alumno"
                required
                value={idAlumno}
                onChange={(e) => setIdAlumno(e.target.value)}
                disabled={isSubmitting || alumnos.loading}
              >
                <option value="" disabled>
                  Selecciona un alumno
                </option>
                {alumnos.data?.map((a) => (
                  <option key={a.id_alumno} value={a.id_alumno}>
                    {a.matricula} — {a.nombre} {a.apellido_paterno}
                  </option>
                ))}
              </select>
            </div>

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
                disabled={isSubmitting || !idAlumno}
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
