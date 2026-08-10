import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAlumnos, type AlumnoOut } from '@/api/alumnos'
import { getAsignaturas, getGrupoAsignaturas, getGrupos, type AsignaturaOut, type GrupoAsignaturaOut, type GrupoOut } from '@/api/academico'
import { getCalificaciones, type CalificacionOut } from '@/api/calificaciones'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 21 (GET /calificacion):
// D (solo sus grupo_asignatura, vía RLS), X, A (todo el plantel) -- el
// scope ya lo aplica el backend, esta pantalla no filtra nada aparte. D ve
// botón de captura (ficha 22, X/A no tienen C); "Corregir" (ficha 23) se
// ofrece a los 3 porque toda fila que aparece aquí ya está dentro del
// scope de quien la ve.
async function fetchListadoData() {
  const [calificaciones, alumnos, grupoAsignaturas, grupos, asignaturas] = await Promise.all([
    getCalificaciones(),
    getAlumnos(),
    getGrupoAsignaturas(),
    getGrupos(),
    getAsignaturas(),
  ])
  return { calificaciones, alumnos, grupoAsignaturas, grupos, asignaturas }
}

interface ListadoData {
  calificaciones: CalificacionOut[]
  alumnos: AlumnoOut[]
  grupoAsignaturas: GrupoAsignaturaOut[]
  grupos: GrupoOut[]
  asignaturas: AsignaturaOut[]
}

const ESTATUS_CLASSNAME: Record<CalificacionOut['estatus'], string> = {
  aprobado: 'bg-green-100 text-green-800',
  reprobado: 'bg-error-container text-on-error-container',
  pendiente: 'bg-surface-container text-secondary',
}

export function CalificacionListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const listado = useApiQuery<ListadoData>(fetchListadoData)

  useEffect(() => {
    if (personal.unauthorized || listado.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, listado.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const esDocente = personal.data?.rol === 'docente'

  function nombreAlumno(idAlumno: number): string {
    const a = listado.data?.alumnos.find((x) => x.id_alumno === idAlumno)
    return a ? `${a.nombre} ${a.apellido_paterno}` : `Alumno ${idAlumno}`
  }

  function grupoYAsignatura(idGrupoAsig: number): string {
    const ga = listado.data?.grupoAsignaturas.find((x) => x.id_grupo_asig === idGrupoAsig)
    if (!ga) return `Grupo_asignatura ${idGrupoAsig}`
    const grupo = listado.data?.grupos.find((g) => g.id_grupo === ga.id_grupo)?.nombre_grupo ?? ga.id_grupo
    const asignatura =
      listado.data?.asignaturas.find((a) => a.id_asignatura === ga.id_asignatura)?.nombre ?? ga.id_asignatura
    return `${grupo} — ${asignatura}`
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/calificacion')}
      greetingSubtitle="Consulta y corrige calificaciones."
      onLogout={handleLogout}
    >
      <section className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Calificaciones</h2>
          {esDocente && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/calificacion/nueva"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Capturar calificación
            </Link>
          )}
        </div>

        {listado.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{listado.error}</p>
          </div>
        ) : listado.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : listado.data && listado.data.calificaciones.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Alumno</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Grupo — Asignatura</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">P1</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">P2</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">P3</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Final</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estatus</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />
                </tr>
              </thead>
              <tbody>
                {listado.data.calificaciones.map((c) => (
                  <tr key={c.id_calificacion} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreAlumno(c.id_alumno)}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{grupoYAsignatura(c.id_grupo_asig)}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{c.parcial_1 ?? '—'}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{c.parcial_2 ?? '—'}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{c.parcial_3 ?? '—'}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface font-bold">{c.calificacion_final ?? '—'}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm ${ESTATUS_CLASSNAME[c.estatus]}`}
                      >
                        {c.estatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <Link
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-sm rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                        to={`/calificacion/${c.id_calificacion}/editar`}
                      >
                        Corregir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">
            {esDocente
              ? 'Aún no has capturado calificaciones en tus grupos.'
              : 'No hay calificaciones capturadas en el plantel todavía.'}
          </p>
        )}
      </section>
    </DashboardShell>
  )
}
