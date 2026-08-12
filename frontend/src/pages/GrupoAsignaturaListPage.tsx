import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAsignaturas, getGrupoAsignaturas, getGrupos, type AsignaturaOut, type GrupoAsignaturaOut, type GrupoOut } from '@/api/academico'
import { ForbiddenError } from '@/api/client'
import { getPersonal, getPersonalMe, type PersonalMe, type PersonalOut } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface FormData {
  grupoAsignaturas: GrupoAsignaturaOut[]
  grupos: GrupoOut[]
  asignaturas: AsignaturaOut[]
}

async function fetchListData(): Promise<FormData> {
  const [grupoAsignaturas, grupos, asignaturas] = await Promise.all([
    getGrupoAsignaturas(),
    getGrupos(),
    getAsignaturas(),
  ])
  return { grupoAsignaturas, grupos, asignaturas }
}

// GET /personal exige rol X/A (require_roles) -- un docente no puede
// resolver el nombre de otros docentes con esta llamada. No hace falta:
// RLS ya acota grupo_asignatura_select a las filas del propio docente, así
// que su nombre lo resolvemos con personal.me en vez de esta lista (ver
// nombreDocente más abajo). Para X/A sí trae la lista completa.
async function fetchPersonalOrEmpty(): Promise<PersonalOut[]> {
  try {
    return await getPersonal()
  } catch (err) {
    if (err instanceof ForbiddenError) return []
    throw err
  }
}

// docs/frontend/02-especificacion-contenido.md, ficha 14 (GET /grupo-asignatura):
// D, X, A pueden consultar -- D solo ve sus propias asignaciones (RLS,
// grupo_asignatura_select en db/ddl_mvp.sql), sin filtro adicional en el
// service (ver comentario en app/domains/academico/router.py). El botón de
// alta (ficha 15) solo se ofrece a X, A.
export function GrupoAsignaturaListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchListData)
  const personalList = useApiQuery<PersonalOut[]>(fetchPersonalOrEmpty)

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

  function nombreGrupo(idGrupo: number): string {
    return formData.data?.grupos.find((g) => g.id_grupo === idGrupo)?.nombre_grupo ?? `Grupo #${idGrupo}`
  }

  function nombreAsignatura(idAsignatura: number): string {
    return formData.data?.asignaturas.find((a) => a.id_asignatura === idAsignatura)?.nombre ?? `Materia #${idAsignatura}`
  }

  function nombreDocente(idDocente: number): string {
    const encontrado = personalList.data?.find((p) => p.id_personal === idDocente)
    if (encontrado) return `${encontrado.nombre} ${encontrado.apellido_paterno}`
    if (personal.data?.id_personal === idDocente) return `${personal.data.nombre} ${personal.data.apellido_paterno}`
    return `Docente #${idDocente}`
  }

  const puedeCrear = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/grupo-asignatura')}
      greetingSubtitle="Consulta las asignaciones de docente a grupo y materia."
      onLogout={handleLogout}
    >
      <section className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Asignaciones docente-grupo-materia</h2>
          {puedeCrear && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/grupo-asignatura/nueva"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nueva asignación
            </Link>
          )}
        </div>

        {formData.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{formData.error}</p>
          </div>
        ) : formData.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : formData.data && formData.data.grupoAsignaturas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Grupo</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Asignatura</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Docente</th>
                  {puedeCrear && <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />}
                </tr>
              </thead>
              <tbody>
                {formData.data.grupoAsignaturas.map((ga) => (
                  <tr key={ga.id_grupo_asig} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreGrupo(ga.id_grupo)}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreAsignatura(ga.id_asignatura)}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreDocente(ga.id_docente)}</td>
                    {puedeCrear && (
                      <td className="p-4">
                        <Link
                          className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                          to={`/grupo-asignatura/${ga.id_grupo_asig}/editar`}
                        >
                          Editar
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Aún no hay asignaciones registradas.</p>
        )}
      </section>
    </DashboardShell>
  )
}
