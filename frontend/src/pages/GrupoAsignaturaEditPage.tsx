import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getAsignaturas,
  getGrupoAsignaturas,
  getGrupos,
  putGrupoAsignatura,
  type AsignaturaOut,
  type GrupoAsignaturaOut,
  type GrupoOut,
} from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPeriodosSemestrales, type PeriodoSemestralOut } from '@/api/organizacional'
import { getPersonal, getPersonalMe, type PersonalMe, type PersonalOut } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface FormData {
  grupoAsignaturas: GrupoAsignaturaOut[]
  grupos: GrupoOut[]
  asignaturas: AsignaturaOut[]
  periodos: PeriodoSemestralOut[]
  personal: PersonalOut[]
}

async function fetchFormData(): Promise<FormData> {
  const [grupoAsignaturas, grupos, asignaturas, periodos, personal] = await Promise.all([
    getGrupoAsignaturas(),
    getGrupos(),
    getAsignaturas(),
    getPeriodosSemestrales(),
    getPersonal(),
  ])
  return { grupoAsignaturas, grupos, asignaturas, periodos, personal }
}

// docs/frontend/02-especificacion-contenido.md, ficha 27
// (PUT /grupo-asignatura/{id}): X, A. id_grupo/id_asignatura no son
// editables aquí (para reasignarlos se crea una nueva asignación, ficha
// 15) -- se muestran de solo lectura. Mismos dos rechazos que el POST:
// id_docente inválido -> 400 (DocenteInvalidoError, ya existía);
// uq_grupo_asignatura_periodo -> 409 (corregido en esta entrega).
export function GrupoAsignaturaEditPage() {
  const navigate = useNavigate()
  const { idGrupoAsig } = useParams<{ idGrupoAsig: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idDocente, setIdDocente] = useState('')
  const [idPeriodo, setIdPeriodo] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const grupoAsignatura = formData.data?.grupoAsignaturas.find(
    (ga) => ga.id_grupo_asig === Number(idGrupoAsig),
  )
  const docentes = useMemo(
    () => formData.data?.personal.filter((p) => p.rol === 'docente' && p.estatus === 'activo') ?? [],
    [formData.data],
  )

  useEffect(() => {
    if (personal.unauthorized || formData.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (formData.data && !initialized) {
      if (!grupoAsignatura) {
        setNotFound(true)
      } else {
        setIdDocente(String(grupoAsignatura.id_docente))
        setIdPeriodo(String(grupoAsignatura.id_periodo))
      }
      setInitialized(true)
    }
  }, [personal.unauthorized, formData.unauthorized, formData.data, grupoAsignatura, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idGrupoAsig) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      await putGrupoAsignatura(Number(idGrupoAsig), {
        id_docente: Number(idDocente),
        id_periodo: Number(idPeriodo),
      })
      setSuccess('Asignación actualizada correctamente.')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar asignaciones.')
      } else if (err instanceof ApiError && err.message.includes('no encontrado')) {
        setNotFound(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar la asignación.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const nombreGrupo = formData.data?.grupos.find((g) => g.id_grupo === grupoAsignatura?.id_grupo)?.nombre_grupo
  const nombreAsignatura = formData.data?.asignaturas.find(
    (a) => a.id_asignatura === grupoAsignatura?.id_asignatura,
  )?.nombre

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/grupo-asignatura')}
      greetingSubtitle="Reasigna el docente o el periodo de una asignación."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Edición de asignación</h2>

          {formData.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : formData.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {formData.error}
            </div>
          ) : notFound ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Asignación no encontrada.
            </div>
          ) : (
            <>
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

              <dl className="grid grid-cols-2 gap-sm mb-md">
                <div>
                  <dt className="font-label-md text-label-md text-secondary">Grupo</dt>
                  <dd className="font-body-md text-body-md text-on-surface">{nombreGrupo}</dd>
                </div>
                <div>
                  <dt className="font-label-md text-label-md text-secondary">Asignatura</dt>
                  <dd className="font-body-md text-body-md text-on-surface">{nombreAsignatura}</dd>
                </div>
              </dl>

              <form className="space-y-md" onSubmit={handleSubmit}>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_docente">
                    Docente
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                    id="id_docente"
                    required
                    value={idDocente}
                    onChange={(e) => setIdDocente(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="" disabled>
                      Selecciona un docente
                    </option>
                    {docentes.map((d) => (
                      <option key={d.id_personal} value={d.id_personal}>
                        {d.nombre} {d.apellido_paterno}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_periodo">
                    Periodo semestral
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                    id="id_periodo"
                    required
                    value={idPeriodo}
                    onChange={(e) => setIdPeriodo(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="" disabled>
                      Selecciona un periodo
                    </option>
                    {formData.data?.periodos.map((p) => (
                      <option key={p.id_periodo} value={p.id_periodo}>
                        {p.clave_periodo} {p.activo ? '(activo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-sm">
                  <button
                    className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </DashboardShell>
  )
}
