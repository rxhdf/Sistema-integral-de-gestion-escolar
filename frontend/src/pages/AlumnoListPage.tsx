import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGrupos, type GrupoOut } from '@/api/academico'
import { getAlumnosFull, postAlumnoInscribir, type AlumnoRow } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 16 (GET /alumno):
// D, X, A pueden consultar -- el payload ya viene filtrado por rol desde el
// backend (AlumnoOutDocente vs. AlumnoOutDirectivo), así que las columnas
// fecha_nacimiento/email/telefono_personal se pintan condicionadas a que la
// clave exista en el dato Y el rol no sea docente -- nunca se ocultan por
// CSS ni se reconstruye el filtrado en el cliente.
//
// La inscripción (ficha 18, POST /alumno/{id}/inscribir) vive como acción
// en línea por fila -- mismo patrón que el toggle activar/desactivar de
// PeriodoSemestralListPage, no un formulario aparte, porque solo mueve un
// campo (id_grupo, nullable hasta este punto).
export function AlumnoListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const alumnos = useApiQuery<AlumnoRow[]>(getAlumnosFull)
  const grupos = useApiQuery<GrupoOut[]>(getGrupos)

  const [rows, setRows] = useState<AlumnoRow[] | null>(null)
  const [inscribiendoId, setInscribiendoId] = useState<number | null>(null)
  const [grupoSeleccionado, setGrupoSeleccionado] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    if (alumnos.data) setRows(alumnos.data)
  }, [alumnos.data])

  useEffect(() => {
    if (personal.unauthorized || alumnos.unauthorized || grupos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, alumnos.unauthorized, grupos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeEscribir = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'
  const esDocente = personal.data?.rol === 'docente'

  function nombreGrupo(idGrupo: number | null): string {
    if (idGrupo === null) return 'Sin grupo'
    return grupos.data?.find((g) => g.id_grupo === idGrupo)?.nombre_grupo ?? `Grupo ${idGrupo}`
  }

  function abrirInscripcion(idAlumno: number) {
    setError(null)
    setAnnouncement(null)
    setInscribiendoId(idAlumno)
    setGrupoSeleccionado('')
  }

  async function confirmarInscripcion(alumno: AlumnoRow) {
    if (!grupoSeleccionado) return
    setError(null)
    setAnnouncement(null)
    setPendingId(alumno.id_alumno)
    try {
      const actualizado = await postAlumnoInscribir(alumno.id_alumno, Number(grupoSeleccionado))
      setRows((prev) => (prev ? prev.map((a) => (a.id_alumno === actualizado.id_alumno ? actualizado : a)) : prev))
      setAnnouncement(`${actualizado.nombre} ${actualizado.apellido_paterno} inscrito en ${nombreGrupo(actualizado.id_grupo)}.`)
      setInscribiendoId(null)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para inscribir alumnos.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo inscribir al alumno.')
      }
    } finally {
      setPendingId(null)
    }
  }

  const loading = alumnos.loading || grupos.loading

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Consulta los alumnos registrados."
      onLogout={handleLogout}
    >
      <section className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Alumnos</h2>
          {puedeEscribir && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/alumno/nuevo"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo alumno
            </Link>
          )}
        </div>

        <div aria-live="assertive">
          {announcement && (
            <div className="rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
              {announcement}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {error}
            </div>
          )}
        </div>

        {alumnos.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{alumnos.error}</p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Matrícula</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">CURP</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Grupo</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estatus</th>
                  {!esDocente && (
                    <>
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Fecha nacimiento</th>
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Email</th>
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Teléfono</th>
                    </>
                  )}
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id_alumno} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{a.matricula}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">
                      {a.nombre} {a.apellido_paterno} {a.apellido_materno ?? ''}
                    </td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{a.curp}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreGrupo(a.id_grupo)}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface capitalize">{a.estatus}</td>
                    {!esDocente && (
                      <>
                        <td className="p-4 text-body-md font-body-md text-on-surface">
                          {'fecha_nacimiento' in a ? a.fecha_nacimiento : '—'}
                        </td>
                        <td className="p-4 text-body-md font-body-md text-on-surface">
                          {'email' in a ? (a.email ?? '—') : '—'}
                        </td>
                        <td className="p-4 text-body-md font-body-md text-on-surface">
                          {'telefono_personal' in a ? (a.telefono_personal ?? '—') : '—'}
                        </td>
                      </>
                    )}
                    <td className="p-4">
                      <div className="flex items-center gap-xs">
                        <Link
                          className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                          to={`/alumno/${a.id_alumno}/expediente-academico`}
                        >
                          Ver expediente
                        </Link>
                        <Link
                          className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                          to={`/alumno/${a.id_alumno}/asistencia-resumen`}
                        >
                          Ver asistencia
                        </Link>
                        {puedeEscribir && (
                          <Link
                            className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                            to={`/alumno/${a.id_alumno}/editar`}
                          >
                            Editar
                          </Link>
                        )}
                        {puedeEscribir && a.id_grupo === null && inscribiendoId !== a.id_alumno && (
                          <button
                            type="button"
                            className="min-h-[44px] px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                            onClick={() => abrirInscripcion(a.id_alumno)}
                          >
                            Inscribir
                          </button>
                        )}
                        {puedeEscribir && inscribiendoId === a.id_alumno && (
                          <div className="flex items-center gap-xs">
                            <label className="sr-only" htmlFor={`grupo-${a.id_alumno}`}>
                              Grupo para inscribir a {a.nombre}
                            </label>
                            <select
                              id={`grupo-${a.id_alumno}`}
                              className="min-h-[44px] px-sm border border-outline-variant rounded-md bg-surface text-on-surface font-body-md"
                              value={grupoSeleccionado}
                              onChange={(e) => setGrupoSeleccionado(e.target.value)}
                              disabled={pendingId === a.id_alumno}
                            >
                              <option value="" disabled>
                                Selecciona un grupo
                              </option>
                              {grupos.data?.map((g) => (
                                <option key={g.id_grupo} value={g.id_grupo}>
                                  {g.nombre_grupo}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="min-h-[44px] px-sm py-xs rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={!grupoSeleccionado || pendingId === a.id_alumno}
                              onClick={() => confirmarInscripcion(a)}
                            >
                              {pendingId === a.id_alumno ? '…' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              className="min-h-[44px] px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                              disabled={pendingId === a.id_alumno}
                              onClick={() => setInscribiendoId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Aún no hay alumnos registrados.</p>
        )}
      </section>
    </DashboardShell>
  )
}
