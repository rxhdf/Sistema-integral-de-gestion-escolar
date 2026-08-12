import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAsignaturas, getGrupoAsignaturas, getGrupos, type AsignaturaOut, type GrupoAsignaturaOut, type GrupoOut } from '@/api/academico'
import { getAlumnosFull, type AlumnoRow } from '@/api/alumnos'
import { getAsistencia, type AsistenciaOut } from '@/api/asistencia'
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

const ESTADO_LABEL: Record<AsistenciaOut['estado'], string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  retardo: 'Retardo',
}

// docs/data_dictionary/asistencia.md: D (solo sus grupo_asignatura), X, A
// (todo el plantel) -- vista diaria de captura. El botón "Capturar" solo
// se ofrece a D (RBAC Nivel 1: X/A no capturan ni corrigen, ver ADR-008).
export function AsistenciaListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idGrupoAsig, setIdGrupoAsig] = useState('')
  const [fechaSesion, setFechaSesion] = useState(hoy())

  const fetchAsistencia = useCallback(() => {
    if (!idGrupoAsig || !fechaSesion) return Promise.resolve<AsistenciaOut[]>([])
    return getAsistencia(Number(idGrupoAsig), fechaSesion)
  }, [idGrupoAsig, fechaSesion])
  const asistencia = useApiQuery<AsistenciaOut[]>(fetchAsistencia)

  useEffect(() => {
    if (personal.unauthorized || formData.unauthorized || asistencia.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, formData.unauthorized, asistencia.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function nombreGrupoAsignatura(ga: GrupoAsignaturaOut): string {
    const grupo = formData.data?.grupos.find((g) => g.id_grupo === ga.id_grupo)?.nombre_grupo
    const asignatura = formData.data?.asignaturas.find((a) => a.id_asignatura === ga.id_asignatura)?.nombre
    return `${grupo ?? `Grupo #${ga.id_grupo}`} — ${asignatura ?? `Materia #${ga.id_asignatura}`}`
  }

  function nombreAlumno(idAlumno: number): string {
    const alumno = formData.data?.alumnos.find((a) => a.id_alumno === idAlumno)
    return alumno ? `${alumno.matricula} — ${alumno.nombre} ${alumno.apellido_paterno}` : `Alumno #${idAlumno}`
  }

  const puedeCapturar = personal.data?.rol === 'docente'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/asistencia')}
      greetingSubtitle="Consulta la asistencia registrada por grupo y fecha."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Asistencia</h2>
          {puedeCapturar && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/asistencia/capturar"
            >
              <span className="material-symbols-outlined text-sm">edit_calendar</span>
              Capturar asistencia
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_grupo_asig">
              Grupo / asignatura
            </label>
            <select
              className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
              id="id_grupo_asig"
              value={idGrupoAsig}
              onChange={(e) => setIdGrupoAsig(e.target.value)}
              disabled={formData.loading}
            >
              <option value="">Selecciona un grupo</option>
              {formData.data?.grupoAsignaturas.map((ga) => (
                <option key={ga.id_grupo_asig} value={ga.id_grupo_asig}>
                  {nombreGrupoAsignatura(ga)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_sesion">
              Fecha
            </label>
            <input
              className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
              id="fecha_sesion"
              type="date"
              value={fechaSesion}
              onChange={(e) => setFechaSesion(e.target.value)}
            />
          </div>
        </div>

        {!idGrupoAsig ? (
          <p className="text-body-md font-body-md text-secondary">Selecciona un grupo y una fecha para ver la asistencia.</p>
        ) : asistencia.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar la asistencia</p>
            <p className="font-body-md text-body-md">{asistencia.error}</p>
          </div>
        ) : asistencia.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : asistencia.data && asistencia.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Alumno</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {asistencia.data.map((registro) => (
                  <tr key={registro.id_asistencia} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreAlumno(registro.id_alumno)}</td>
                    <td className="p-4">
                      <span
                        className={
                          registro.estado === 'presente'
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                            : registro.estado === 'retardo'
                              ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-yellow-100 text-yellow-800'
                              : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-error-container text-on-error-container'
                        }
                      >
                        {ESTADO_LABEL[registro.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Sin asistencia capturada para ese grupo y fecha.</p>
        )}
      </section>
    </DashboardShell>
  )
}
