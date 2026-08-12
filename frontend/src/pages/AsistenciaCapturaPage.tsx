import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAsignaturas, getGrupoAsignaturas, getGrupos, type AsignaturaOut, type GrupoAsignaturaOut, type GrupoOut } from '@/api/academico'
import { getAlumnosFull, type AlumnoRow } from '@/api/alumnos'
import {
  getAsistencia,
  postAsistenciaLote,
  type AsistenciaOut,
  type EstadoAsistencia,
} from '@/api/asistencia'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface FormData {
  grupoAsignaturas: GrupoAsignaturaOut[]
  grupos: GrupoOut[]
  asignaturas: AsignaturaOut[]
  alumnos: AlumnoRow[]
}

async function fetchFormData(): Promise<FormData> {
  const [grupoAsignaturas, grupos, asignaturas, alumnos] = await Promise.all([
    getGrupoAsignaturas(),
    getGrupos(),
    getAsignaturas(),
    getAlumnosFull(),
  ])
  return { grupoAsignaturas, grupos, asignaturas, alumnos }
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

// docs/data_dictionary/asistencia.md: D únicamente captura -- X, A nunca
// llegan aquí (RBAC Nivel 1, confirmado con el negocio que tampoco
// corrigen, ver ADR-008). Recapturar el mismo grupo_asignatura+fecha es
// el mecanismo de corrección: se precarga el estado ya capturado ese día
// (si existe) y el mismo submit lo sobreescribe (UPSERT, sin 409).
export function AsistenciaCapturaPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idGrupoAsig, setIdGrupoAsig] = useState('')
  const [fechaSesion, setFechaSesion] = useState(hoy())
  // Solo guarda ediciones EXPLÍCITAS del docente en esta pantalla -- el
  // valor mostrado/enviado siempre se deriva como
  // overrides[id_alumno] ?? previos[id_alumno] ?? 'presente' (ver abajo),
  // nunca se "snapshotea" el estado ya capturado a un momento fijo. Un
  // primer intento que copiaba `previos` a este mismo state una sola vez
  // por combinación grupo+fecha tenía una condición de carrera real: dos
  // useApiQuery independientes (roster y existente) resuelven en paralelo,
  // y el guard "ya inicialicé para esta combinación" podía marcarse en un
  // render intermedio donde `existente.data` todavía traía el resultado
  // vacío de la consulta ANTERIOR (loading:false stale de un efecto
  // hermano que aún no había aplicado su setState) -- una vez marcado, el
  // precargado real nunca se volvía a aplicar. Derivar en cada render
  // elimina la clase entera de bug: no hay "cuándo inicializar" que
  // acertar.
  const [overrides, setOverrides] = useState<Record<number, EstadoAsistencia>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchExisting = useCallback(() => {
    if (!idGrupoAsig || !fechaSesion) return Promise.resolve<AsistenciaOut[]>([])
    return getAsistencia(Number(idGrupoAsig), fechaSesion)
  }, [idGrupoAsig, fechaSesion])
  const existente = useApiQuery<AsistenciaOut[]>(fetchExisting)

  const previos = useMemo(
    () => Object.fromEntries(existente.data?.map((a) => [a.id_alumno, a.estado]) ?? []),
    [existente.data],
  )

  const grupoAsignaturaSeleccionada = formData.data?.grupoAsignaturas.find(
    (ga) => ga.id_grupo_asig === Number(idGrupoAsig),
  )
  const roster = useMemo(
    () =>
      formData.data?.alumnos.filter((a) => a.id_grupo === grupoAsignaturaSeleccionada?.id_grupo) ?? [],
    [formData.data, grupoAsignaturaSeleccionada],
  )

  function estadoDe(idAlumno: number): EstadoAsistencia {
    return overrides[idAlumno] ?? previos[idAlumno] ?? 'presente'
  }

  useEffect(() => {
    if (personal.unauthorized || formData.unauthorized || existente.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, formData.unauthorized, existente.unauthorized, navigate])

  // Limpia las ediciones manuales al cambiar de grupo o fecha -- son
  // específicas de esa combinación, no deben arrastrarse a la siguiente.
  useEffect(() => {
    setOverrides({})
  }, [idGrupoAsig, fechaSesion])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function nombreGrupoAsignatura(ga: GrupoAsignaturaOut): string {
    const grupo = formData.data?.grupos.find((g) => g.id_grupo === ga.id_grupo)?.nombre_grupo
    const asignatura = formData.data?.asignaturas.find((a) => a.id_asignatura === ga.id_asignatura)?.nombre
    return `${grupo ?? `Grupo #${ga.id_grupo}`} — ${asignatura ?? `Materia #${ga.id_asignatura}`}`
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idGrupoAsig || roster.length === 0) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      await postAsistenciaLote({
        id_grupo_asig: Number(idGrupoAsig),
        fecha_sesion: fechaSesion,
        registros: roster.map((a) => ({ id_alumno: a.id_alumno, estado: estadoDe(a.id_alumno) })),
      })
      setSuccess(`Asistencia de ${roster.length} alumno(s) guardada para ${fechaSesion}.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para capturar asistencia.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo guardar la asistencia.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/asistencia')}
      greetingSubtitle="Captura o corrige la asistencia de tu grupo."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Captura de asistencia</h2>

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
            <div className="grid grid-cols-2 gap-sm">
              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_grupo_asig">
                  Grupo / asignatura
                </label>
                <select
                  className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                  id="id_grupo_asig"
                  required
                  value={idGrupoAsig}
                  onChange={(e) => setIdGrupoAsig(e.target.value)}
                  disabled={isSubmitting || formData.loading}
                >
                  <option value="" disabled>
                    Selecciona un grupo
                  </option>
                  {formData.data?.grupoAsignaturas.map((ga) => (
                    <option key={ga.id_grupo_asig} value={ga.id_grupo_asig}>
                      {nombreGrupoAsignatura(ga)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_sesion">
                  Fecha de la sesión
                </label>
                <input
                  className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                  id="fecha_sesion"
                  required
                  type="date"
                  value={fechaSesion}
                  onChange={(e) => setFechaSesion(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {idGrupoAsig && (
              <div className="overflow-x-auto">
                {existente.loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} aria-hidden="true" className="h-10 bg-surface-container animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : roster.length === 0 ? (
                  <p className="text-body-md font-body-md text-secondary">Este grupo no tiene alumnos inscritos.</p>
                ) : (
                  <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-surface-container text-left">
                        <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Matrícula</th>
                        <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                        <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((a) => (
                        <tr key={a.id_alumno} className="border-t border-surface-variant">
                          <td className="p-4 text-body-md font-body-md text-on-surface">{a.matricula}</td>
                          <td className="p-4 text-body-md font-body-md text-on-surface">
                            {a.nombre} {a.apellido_paterno}
                          </td>
                          <td className="p-4">
                            <select
                              className="px-sm py-xs border border-outline-variant rounded-md bg-surface text-on-surface font-body-md min-h-[44px]"
                              aria-label={`Estado de ${a.nombre} ${a.apellido_paterno}`}
                              value={estadoDe(a.id_alumno)}
                              onChange={(e) =>
                                setOverrides((prev) => ({ ...prev, [a.id_alumno]: e.target.value as EstadoAsistencia }))
                              }
                              disabled={isSubmitting}
                            >
                              <option value="presente">Presente</option>
                              <option value="ausente">Ausente</option>
                              <option value="retardo">Retardo</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="pt-sm">
              <button
                className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={isSubmitting || !idGrupoAsig || roster.length === 0}
              >
                {isSubmitting ? 'Guardando…' : 'Guardar asistencia'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </DashboardShell>
  )
}
