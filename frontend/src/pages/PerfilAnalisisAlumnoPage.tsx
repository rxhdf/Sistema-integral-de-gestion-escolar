import { useCallback, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAsignaturas, getGrupoAsignaturas, getGrupos, type AsignaturaOut, type GrupoAsignaturaOut, type GrupoOut } from '@/api/academico'
import { getAlumnosFull, type AlumnoRow } from '@/api/alumnos'
import { getAsistenciaResumen, type AsistenciaResumenOut } from '@/api/asistencia'
import { getCalificaciones, type CalificacionOut } from '@/api/calificaciones'
import { getExpedienteAcademico, type ExpedienteAcademicoOut } from '@/api/alumnos'
import { getPeriodosSemestrales } from '@/api/organizacional'
import { getPersonal, getPersonalMe, type PersonalMe, type PersonalOut } from '@/api/personal'
import { getReporteIncidencia, type ReporteIncidenciaOut } from '@/api/reportes'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface DesempenoRow {
  materia: string
  parcial_1: number | null
  parcial_2: number | null
  parcial_3: number | null
  calificacion_final: number | null
  estatus: CalificacionOut['estatus']
}

interface PerfilData {
  alumno: AlumnoRow | null
  grupoNombre: string
  expediente: ExpedienteAcademicoOut | null
  desempeno: DesempenoRow[]
  resumenAsistencia: AsistenciaResumenOut
  incidencias: ReporteIncidenciaOut[]
  personal: PersonalOut[]
}

// docs/data_dictionary/perfil-analisis-alumno.md, Pieza 3: composición en
// cliente de 4 fuentes ya existentes, mismo patrón que "Mis grupos"
// (frontend/src/lib/misGrupos.ts) -- deuda técnica de N+1 requests ya
// aceptada ahí, mismo trade-off aquí. No hay GET /alumno/{id} propio: se
// busca en el listado ya pedido, igual que Grupo/Asignatura/Personal edit.
async function fetchPerfil(idAlumno: number): Promise<PerfilData> {
  const [alumnos, grupos, asignaturas, grupoAsignaturas, calificaciones, periodos, resumenAsistencia, expediente, incidencias, personal] =
    await Promise.all([
      getAlumnosFull(),
      getGrupos(),
      getAsignaturas(),
      getGrupoAsignaturas(),
      getCalificaciones(),
      getPeriodosSemestrales(),
      getAsistenciaResumen(idAlumno),
      getExpedienteAcademico(idAlumno).catch(() => null),
      getReporteIncidencia(idAlumno),
      getPersonal(),
    ])

  const alumno = alumnos.find((a) => a.id_alumno === idAlumno) ?? null
  const grupoNombre =
    alumno?.id_grupo != null
      ? grupos.find((g: GrupoOut) => g.id_grupo === alumno.id_grupo)?.nombre_grupo ?? `Grupo ${alumno.id_grupo}`
      : 'Sin grupo'

  const periodoActivoId = periodos.find((p) => p.activo)?.id_periodo
  const gaDelPeriodoActivo = new Set(
    grupoAsignaturas.filter((ga: GrupoAsignaturaOut) => ga.id_periodo === periodoActivoId).map((ga) => ga.id_grupo_asig),
  )
  const desempeno: DesempenoRow[] = calificaciones
    .filter((c) => c.id_alumno === idAlumno && gaDelPeriodoActivo.has(c.id_grupo_asig))
    .map((c) => {
      const ga = grupoAsignaturas.find((g) => g.id_grupo_asig === c.id_grupo_asig)
      const materia =
        asignaturas.find((a: AsignaturaOut) => a.id_asignatura === ga?.id_asignatura)?.nombre ??
        `Materia #${ga?.id_asignatura ?? '?'}`
      return {
        materia,
        parcial_1: c.parcial_1,
        parcial_2: c.parcial_2,
        parcial_3: c.parcial_3,
        calificacion_final: c.calificacion_final,
        estatus: c.estatus,
      }
    })

  return { alumno, grupoNombre, expediente, desempeno, resumenAsistencia, incidencias, personal }
}

function nombreDocenteReporta(personal: PersonalOut[], idPersonal: number): string {
  const p = personal.find((x) => x.id_personal === idPersonal)
  return p ? `${p.nombre} ${p.apellido_paterno}` : `Personal #${idPersonal}`
}

// Roles: exclusivo de directivo/admin (docs/data_dictionary/perfil-analisis-alumno.md).
// Sin endpoint agregador propio que 403 a un docente por URL directa -- las
// 4 fuentes compuestas responderían para un docente dentro de su propio
// scope RLS, así que el bloqueo es un gate explícito en el cliente, igual
// que en AlumnoBuscarPage.tsx.
export function PerfilAnalisisAlumnoPage() {
  const navigate = useNavigate()
  const { idAlumno } = useParams<{ idAlumno: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const fetchData = useCallback(() => fetchPerfil(Number(idAlumno)), [idAlumno])
  const perfil = useApiQuery<PerfilData>(fetchData)

  useEffect(() => {
    if (personal.unauthorized || perfil.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, perfil.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const esDocente = personal.data?.rol === 'docente'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno/buscar')}
      greetingSubtitle="Perfil de análisis del alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-4xl space-y-6">
        <Link className="font-label-md text-label-md text-primary hover:underline" to="/alumno/buscar">
          ← Volver al buscador
        </Link>

        {esDocente ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold">No tienes permiso para ver esta pantalla.</p>
          </div>
        ) : perfil.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el perfil</p>
            <p className="font-body-md text-body-md">{perfil.error}</p>
          </div>
        ) : perfil.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !perfil.data?.alumno ? (
          <p className="text-body-md font-body-md text-secondary">Alumno no encontrado.</p>
        ) : (
          <>
            <h2 className="text-headline-md font-headline-md font-bold text-on-surface">
              {perfil.data.alumno.nombre} {perfil.data.alumno.apellido_paterno} {perfil.data.alumno.apellido_materno ?? ''}
            </h2>

            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 space-y-2">
              <h3 className="text-title-md font-title-md font-bold text-on-surface">Identidad y origen</h3>
              <dl className="grid grid-cols-2 gap-sm font-body-md text-body-md text-on-surface">
                <dt className="text-secondary">Matrícula</dt>
                <dd>{perfil.data.alumno.matricula}</dd>
                <dt className="text-secondary">CURP</dt>
                <dd>{perfil.data.alumno.curp}</dd>
                <dt className="text-secondary">Grupo</dt>
                <dd>{perfil.data.grupoNombre}</dd>
                <dt className="text-secondary">Municipio de origen</dt>
                <dd>{perfil.data.alumno.municipio_origen ?? 'Sin capturar'}</dd>
                <dt className="text-secondary">Localidad de origen</dt>
                <dd>{perfil.data.alumno.localidad_origen ?? 'Sin capturar'}</dd>
                <dt className="text-secondary">Escuela de procedencia</dt>
                <dd>{perfil.data.expediente?.escuela_procedencia ?? 'Sin capturar'}</dd>
              </dl>
            </div>

            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 space-y-2">
              <h3 className="text-title-md font-title-md font-bold text-on-surface">Desempeño académico</h3>
              <dl className="grid grid-cols-2 gap-sm font-body-md text-body-md text-on-surface mb-4">
                <dt className="text-secondary">Situación académica</dt>
                <dd className="capitalize">{perfil.data.expediente?.situacion_academica ?? 'Sin expediente'}</dd>
                <dt className="text-secondary">Promedio actual</dt>
                <dd>{perfil.data.expediente?.promedio_actual ?? '—'}</dd>
              </dl>
              {perfil.data.desempeno.length === 0 ? (
                <p className="text-body-md font-body-md text-secondary">Sin calificaciones en el periodo activo.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th scope="col" className="p-2 text-label-md font-label-md text-secondary">Materia</th>
                      <th scope="col" className="p-2 text-label-md font-label-md text-secondary">P1</th>
                      <th scope="col" className="p-2 text-label-md font-label-md text-secondary">P2</th>
                      <th scope="col" className="p-2 text-label-md font-label-md text-secondary">P3</th>
                      <th scope="col" className="p-2 text-label-md font-label-md text-secondary">Final</th>
                      <th scope="col" className="p-2 text-label-md font-label-md text-secondary">Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfil.data.desempeno.map((d, i) => (
                      <tr key={i} className="border-t border-surface-variant">
                        <td className="p-2 text-body-md font-body-md text-on-surface">{d.materia}</td>
                        <td className="p-2 text-body-md font-body-md text-on-surface">{d.parcial_1 ?? '—'}</td>
                        <td className="p-2 text-body-md font-body-md text-on-surface">{d.parcial_2 ?? '—'}</td>
                        <td className="p-2 text-body-md font-body-md text-on-surface">{d.parcial_3 ?? '—'}</td>
                        <td className="p-2 text-body-md font-body-md text-on-surface">{d.calificacion_final ?? '—'}</td>
                        <td className="p-2 text-body-md font-body-md text-on-surface capitalize">{d.estatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <h3 className="text-title-md font-title-md font-bold text-on-surface mb-2">Asistencia</h3>
              <div className="grid grid-cols-4 gap-sm font-body-md text-body-md text-on-surface">
                <div>
                  <p className="text-secondary">Presente</p>
                  <p className="text-headline-md font-headline-md font-bold">{perfil.data.resumenAsistencia.presente}</p>
                </div>
                <div>
                  <p className="text-secondary">Ausente</p>
                  <p className="text-headline-md font-headline-md font-bold">{perfil.data.resumenAsistencia.ausente}</p>
                </div>
                <div>
                  <p className="text-secondary">Retardo</p>
                  <p className="text-headline-md font-headline-md font-bold">{perfil.data.resumenAsistencia.retardo}</p>
                </div>
                <div>
                  <p className="text-secondary">Total</p>
                  <p className="text-headline-md font-headline-md font-bold">{perfil.data.resumenAsistencia.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <h3 className="text-title-md font-title-md font-bold text-on-surface mb-2">Incidencias</h3>
              {perfil.data.incidencias.length === 0 ? (
                <p className="text-body-md font-body-md text-secondary">Sin incidencias registradas.</p>
              ) : (
                <ul className="space-y-3">
                  {perfil.data.incidencias.map((r) => (
                    <li key={r.id_reporte_incidencia} className="border-t border-surface-variant pt-3 first:border-t-0 first:pt-0">
                      <p className="font-label-md text-label-md text-secondary">
                        {r.fecha_incidente} — {nombreDocenteReporta(perfil.data!.personal, r.id_personal_reporta)}
                      </p>
                      <p className="font-body-md text-body-md text-on-surface">{r.descripcion}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </DashboardShell>
  )
}
