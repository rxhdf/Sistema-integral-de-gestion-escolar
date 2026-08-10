import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlumnos, type AlumnoOut } from '@/api/alumnos'
import { getAsignaturas, getGrupoAsignaturas, getGrupos, type AsignaturaOut, type GrupoAsignaturaOut, type GrupoOut } from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { postCalificacion, type CalificacionOut } from '@/api/calificaciones'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 22 (POST /calificacion):
// D únicamente. calificacion_final/estatus NUNCA son campos de entrada
// (ADR-005) -- CalificacionCreate (api/calificaciones.ts) ni los declara,
// solo se muestran como resultado de solo lectura tras el POST.
async function fetchFormData() {
  const [grupoAsignaturas, grupos, asignaturas, alumnos] = await Promise.all([
    getGrupoAsignaturas(),
    getGrupos(),
    getAsignaturas(),
    getAlumnos(),
  ])
  return { grupoAsignaturas, grupos, asignaturas, alumnos }
}

interface FormData {
  grupoAsignaturas: GrupoAsignaturaOut[]
  grupos: GrupoOut[]
  asignaturas: AsignaturaOut[]
  alumnos: AlumnoOut[]
}

export function CalificacionCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idGrupoAsig, setIdGrupoAsig] = useState('')
  const [idAlumno, setIdAlumno] = useState('')
  const [parcial1, setParcial1] = useState('')
  const [parcial2, setParcial2] = useState('')
  const [parcial3, setParcial3] = useState('')
  const [tipoEvaluacion, setTipoEvaluacion] = useState<'ordinaria' | 'extraordinaria'>('ordinaria')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<CalificacionOut | null>(null)

  useEffect(() => {
    if (personal.unauthorized || formData.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, formData.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const grupoAsignaturaSeleccionada = formData.data?.grupoAsignaturas.find(
    (ga) => String(ga.id_grupo_asig) === idGrupoAsig,
  )
  const alumnosDelGrupo = useMemo(() => {
    if (!formData.data || !grupoAsignaturaSeleccionada) return []
    return formData.data.alumnos.filter((a) => a.id_grupo === grupoAsignaturaSeleccionada.id_grupo)
  }, [formData.data, grupoAsignaturaSeleccionada])

  function nombreGrupoAsig(ga: GrupoAsignaturaOut): string {
    const grupo = formData.data?.grupos.find((g) => g.id_grupo === ga.id_grupo)?.nombre_grupo ?? ga.id_grupo
    const asignatura =
      formData.data?.asignaturas.find((a) => a.id_asignatura === ga.id_asignatura)?.nombre ?? ga.id_asignatura
    return `${grupo} — ${asignatura}`
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResultado(null)
    setIsSubmitting(true)
    try {
      const calificacion = await postCalificacion({
        id_alumno: Number(idAlumno),
        id_grupo_asig: Number(idGrupoAsig),
        parcial_1: parcial1 === '' ? null : Number(parcial1),
        parcial_2: parcial2 === '' ? null : Number(parcial2),
        parcial_3: parcial3 === '' ? null : Number(parcial3),
        tipo_evaluacion: tipoEvaluacion,
      })
      setResultado(calificacion)
      setIdAlumno('')
      setParcial1('')
      setParcial2('')
      setParcial3('')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para capturar esta calificación.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo capturar la calificación.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/calificacion')}
      greetingSubtitle="Registra los parciales de un alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Captura de calificación</h2>

          {/* Afecta la calificación oficial de un alumno -- assertive, no
              polite (ficha 22, distinto del resto de los formularios). */}
          <div aria-live="assertive">
            {error && (
              <div className="mb-4 rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                {error}
              </div>
            )}
            {resultado && (
              <div className="mb-4 rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                Calificación capturada. Final: {resultado.calificacion_final ?? '—'} ({resultado.estatus}).
              </div>
            )}
          </div>

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_grupo_asig">
                Grupo / Asignatura
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="id_grupo_asig"
                required
                value={idGrupoAsig}
                onChange={(e) => {
                  setIdGrupoAsig(e.target.value)
                  setIdAlumno('')
                }}
                disabled={isSubmitting || formData.loading}
              >
                <option value="" disabled>
                  Selecciona grupo y asignatura
                </option>
                {formData.data?.grupoAsignaturas.map((ga) => (
                  <option key={ga.id_grupo_asig} value={ga.id_grupo_asig}>
                    {nombreGrupoAsig(ga)}
                  </option>
                ))}
              </select>
            </div>

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
                disabled={isSubmitting || !idGrupoAsig}
              >
                <option value="" disabled>
                  {idGrupoAsig ? 'Selecciona un alumno' : 'Elige primero grupo/asignatura'}
                </option>
                {alumnosDelGrupo.map((a) => (
                  <option key={a.id_alumno} value={a.id_alumno}>
                    {a.nombre} {a.apellido_paterno} ({a.matricula})
                  </option>
                ))}
              </select>
            </div>

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
            <p className="text-label-sm font-label-sm text-secondary">
              Un solo parcial es suficiente para guardar; la calificación final se calcula sobre los disponibles.
            </p>

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
                disabled={isSubmitting || !idGrupoAsig || !idAlumno}
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
