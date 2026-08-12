import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getGrupos, putGrupo, type GrupoOut } from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPeriodosSemestrales, type PeriodoSemestralOut } from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface FormData {
  grupos: GrupoOut[]
  periodos: PeriodoSemestralOut[]
}

async function fetchFormData(): Promise<FormData> {
  const [grupos, periodos] = await Promise.all([getGrupos(), getPeriodosSemestrales()])
  return { grupos, periodos }
}

// docs/frontend/02-especificacion-contenido.md, ficha 25 (PUT /grupo/{id}):
// X, A. Sin GET por id -- se busca en el listado ya pedido (GET /grupo),
// mismo patrón que CalificacionCorrectPage/PersonalEditPage.
// uq_grupo_nombre_periodo -> 409 (corregido en esta entrega, igual que
// el POST).
export function GrupoEditPage() {
  const navigate = useNavigate()
  const { idGrupo } = useParams<{ idGrupo: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idPeriodo, setIdPeriodo] = useState('')
  const [semestre, setSemestre] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [capacidadMaxima, setCapacidadMaxima] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const grupo = formData.data?.grupos.find((g) => g.id_grupo === Number(idGrupo))

  useEffect(() => {
    if (personal.unauthorized || formData.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (formData.data && !initialized) {
      if (!grupo) {
        setNotFound(true)
      } else {
        setIdPeriodo(String(grupo.id_periodo))
        setSemestre(grupo.semestre)
        setNombreGrupo(grupo.nombre_grupo)
        setCapacidadMaxima(grupo.capacidad_maxima?.toString() ?? '')
      }
      setInitialized(true)
    }
  }, [personal.unauthorized, formData.unauthorized, formData.data, grupo, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idGrupo) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const actualizado = await putGrupo(Number(idGrupo), {
        id_periodo: Number(idPeriodo),
        semestre,
        nombre_grupo: nombreGrupo,
        capacidad_maxima: capacidadMaxima ? Number(capacidadMaxima) : null,
      })
      setSuccess(`Grupo "${actualizado.nombre_grupo}" actualizado correctamente.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar grupos.')
      } else if (err instanceof ApiError && err.message.includes('no encontrado')) {
        setNotFound(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar el grupo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/grupo')}
      greetingSubtitle="Edita un grupo."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Edición de grupo</h2>

          {formData.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : formData.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {formData.error}
            </div>
          ) : notFound ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Grupo no encontrado.
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

              <form className="space-y-md" onSubmit={handleSubmit}>
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre_grupo">
                    Nombre
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="nombre_grupo"
                    maxLength={10}
                    required
                    type="text"
                    value={nombreGrupo}
                    onChange={(e) => setNombreGrupo(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="semestre">
                    Semestre
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="semestre"
                    required
                    value={semestre}
                    onChange={(e) => setSemestre(Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6)}
                    disabled={isSubmitting}
                  >
                    {[1, 2, 3, 4, 5, 6].map((s) => (
                      <option key={s} value={s}>
                        {s}
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

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="capacidad_maxima">
                    Capacidad máxima
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="capacidad_maxima"
                    min={0}
                    type="number"
                    value={capacidadMaxima}
                    onChange={(e) => setCapacidadMaxima(e.target.value)}
                    disabled={isSubmitting}
                  />
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
