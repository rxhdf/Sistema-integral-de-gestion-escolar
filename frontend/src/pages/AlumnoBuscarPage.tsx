import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getGrupos, type GrupoOut } from '@/api/academico'
import { getAlumnosFull, type AlumnoRow } from '@/api/alumnos'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/data_dictionary/perfil-analisis-alumno.md, Pieza 2: buscador
// exclusivo de directivo/admin (el diseño anterior consideraba también
// docente, se descartó). No hay endpoint agregador que 403 a un docente
// que llegue aquí por URL directa -- GET /alumno?search= igual le
// respondería (acotado a su propio scope RLS), así que el bloqueo es un
// gate explícito en el cliente, propio del propósito de esta pantalla.
export function AlumnoBuscarPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const grupos = useApiQuery<GrupoOut[]>(getGrupos)

  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const fetchResultados = useCallback(
    () => (query ? getAlumnosFull(query) : Promise.resolve<AlumnoRow[]>([])),
    [query],
  )
  const resultados = useApiQuery<AlumnoRow[]>(fetchResultados)

  useEffect(() => {
    if (personal.unauthorized || grupos.unauthorized || resultados.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, grupos.unauthorized, resultados.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(input.trim())
  }

  function nombreGrupo(idGrupo: number | null): string {
    if (idGrupo === null) return 'Sin grupo'
    return grupos.data?.find((g) => g.id_grupo === idGrupo)?.nombre_grupo ?? `Grupo ${idGrupo}`
  }

  const esDocente = personal.data?.rol === 'docente'

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno/buscar')}
      greetingSubtitle="Localiza un alumno por nombre o CURP."
      onLogout={handleLogout}
    >
      <section className="max-w-3xl space-y-6">
        <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Análisis de alumno</h2>

        {esDocente ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold">No tienes permiso para ver esta pantalla.</p>
          </div>
        ) : (
          <>
            <form className="flex gap-sm" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="search">
                Nombre completo o CURP
              </label>
              <input
                className="flex-1 px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="search"
                type="text"
                placeholder="Nombre completo o CURP"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                className="px-md py-sm rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[44px]"
                type="submit"
              >
                Buscar
              </button>
            </form>

            {resultados.error && (
              <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
                <p className="font-body-md text-body-md">{resultados.error}</p>
              </div>
            )}

            {resultados.loading && query ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
                ))}
              </div>
            ) : query && resultados.data?.length === 0 ? (
              <p className="text-body-md font-body-md text-secondary">Sin resultados para "{query}".</p>
            ) : resultados.data && resultados.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-surface-container text-left">
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Matrícula</th>
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Grupo</th>
                      <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.data.map((a) => (
                      <tr key={a.id_alumno} className="border-t border-surface-variant">
                        <td className="p-4 text-body-md font-body-md text-on-surface">{a.matricula}</td>
                        <td className="p-4 text-body-md font-body-md text-on-surface">
                          {a.nombre} {a.apellido_paterno} {a.apellido_materno ?? ''}
                        </td>
                        <td className="p-4 text-body-md font-body-md text-on-surface">{nombreGrupo(a.id_grupo)}</td>
                        <td className="p-4">
                          <Link
                            className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                            to={`/alumno/${a.id_alumno}/perfil-analisis`}
                          >
                            Ver perfil
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>
    </DashboardShell>
  )
}
