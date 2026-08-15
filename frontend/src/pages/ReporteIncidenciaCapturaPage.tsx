import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlumnoBuscarPlantel, type AlumnoBusquedaDocenteOut } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { postReporteIncidencia } from '@/api/reportes'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

// docs/data_dictionary/reporte-incidencia.md / ADR-010: docente busca
// entre TODOS los alumnos del plantel (GET /alumno/buscar-plantel), no
// solo los de su propio scope -- a diferencia de Calificacion/Asistencia,
// no hay selector de grupo_asignatura aquí en absoluto.
export function ReporteIncidenciaCapturaPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)

  const [busqueda, setBusqueda] = useState('')
  const [query, setQuery] = useState('')
  const fetchResultados = useCallback(
    () => (query ? getAlumnoBuscarPlantel(query) : Promise.resolve<AlumnoBusquedaDocenteOut[]>([])),
    [query],
  )
  const resultados = useApiQuery<AlumnoBusquedaDocenteOut[]>(fetchResultados)

  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoBusquedaDocenteOut | null>(null)
  const [fechaIncidente, setFechaIncidente] = useState(hoy())
  const [descripcion, setDescripcion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || resultados.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, resultados.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function handleBuscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAlumnoSeleccionado(null)
    setQuery(busqueda.trim())
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!alumnoSeleccionado || !descripcion.trim()) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      await postReporteIncidencia({
        id_alumno: alumnoSeleccionado.id_alumno,
        fecha_incidente: fechaIncidente,
        descripcion: descripcion.trim(),
      })
      setSuccess(`Reporte registrado para ${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido_paterno}.`)
      setAlumnoSeleccionado(null)
      setDescripcion('')
      setBusqueda('')
      setQuery('')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para levantar un reporte de incidencia.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo guardar el reporte.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/reporte-incidencia/capturar')}
      greetingSubtitle="Reporta una incidencia de cualquier alumno del plantel."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">
            Reporte de incidencia
          </h2>

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

          <form className="space-y-md mb-6" onSubmit={handleBuscar}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="busqueda">
                Buscar alumno (nombre completo o CURP, cualquiera del plantel)
              </label>
              <div className="flex gap-sm">
                <input
                  className="flex-1 px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                  id="busqueda"
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <button
                  className="px-md py-sm rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[44px]"
                  type="submit"
                >
                  Buscar
                </button>
              </div>
            </div>
          </form>

          {resultados.loading && query ? (
            <div className="space-y-2 mb-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} aria-hidden="true" className="h-10 bg-surface-container animate-pulse rounded-lg" />
              ))}
            </div>
          ) : query && resultados.data?.length === 0 ? (
            <p className="text-body-md font-body-md text-secondary mb-6">Sin resultados para "{query}".</p>
          ) : resultados.data && resultados.data.length > 0 && !alumnoSeleccionado ? (
            <ul className="space-y-2 mb-6">
              {resultados.data.map((a) => (
                <li key={a.id_alumno}>
                  <button
                    type="button"
                    className="w-full text-left px-sm py-sm border border-outline-variant rounded-md hover:bg-surface-container font-body-md text-body-md text-on-surface min-h-[44px]"
                    onClick={() => setAlumnoSeleccionado(a)}
                  >
                    {a.matricula} — {a.nombre} {a.apellido_paterno} {a.apellido_materno ?? ''}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {alumnoSeleccionado && (
            <form className="space-y-md" onSubmit={handleSubmit}>
              <div className="px-sm py-sm bg-surface-container rounded-md font-body-md text-body-md text-on-surface flex justify-between items-center">
                <span>
                  Alumno seleccionado: <strong>{alumnoSeleccionado.nombre} {alumnoSeleccionado.apellido_paterno}</strong> ({alumnoSeleccionado.matricula})
                </span>
                <button
                  type="button"
                  className="font-label-md text-label-md text-primary hover:underline"
                  onClick={() => setAlumnoSeleccionado(null)}
                >
                  Cambiar
                </button>
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_incidente">
                  Fecha del incidente
                </label>
                <input
                  className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                  id="fecha_incidente"
                  required
                  type="date"
                  value={fechaIncidente}
                  onChange={(e) => setFechaIncidente(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-xs">
                <label className="font-label-md text-label-md text-on-surface block" htmlFor="descripcion">
                  Descripción
                </label>
                <textarea
                  className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[100px]"
                  id="descripcion"
                  required
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="pt-sm">
                <button
                  className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={isSubmitting || !descripcion.trim()}
                >
                  {isSubmitting ? 'Guardando…' : 'Registrar reporte'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </DashboardShell>
  )
}
