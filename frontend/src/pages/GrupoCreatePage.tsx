import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { postGrupo } from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPeriodosSemestrales, type PeriodoSemestralOut } from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 11 (POST /grupo):
// X, A pueden dar de alta. id_plantel viene de personal.me (MVP de un solo
// plantel, mismo patrón que PersonalCreatePage) -- no se pide en el
// formulario. uq_grupo_nombre_periodo se traduce a 409 en el service
// (antes 500 crudo, corregido en esta entrega).
export function GrupoCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const periodos = useApiQuery<PeriodoSemestralOut[]>(getPeriodosSemestrales)

  const [idPeriodo, setIdPeriodo] = useState('')
  const [semestre, setSemestre] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [capacidadMaxima, setCapacidadMaxima] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || periodos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, periodos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!personal.data) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const grupo = await postGrupo({
        id_plantel: personal.data.id_plantel,
        id_periodo: Number(idPeriodo),
        semestre,
        nombre_grupo: nombreGrupo,
        capacidad_maxima: capacidadMaxima === '' ? null : Number(capacidadMaxima),
      })
      setSuccess(`Grupo "${grupo.nombre_grupo}" creado correctamente.`)
      setIdPeriodo('')
      setSemestre(1)
      setNombreGrupo('')
      setCapacidadMaxima('')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para crear grupos.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear el grupo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/grupo')}
      greetingSubtitle="Registra un nuevo grupo."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Alta de grupo</h2>

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
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_periodo">
                Periodo semestral
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="id_periodo"
                required
                value={idPeriodo}
                onChange={(e) => setIdPeriodo(e.target.value)}
                disabled={isSubmitting || periodos.loading}
              >
                <option value="" disabled>
                  Selecciona un periodo
                </option>
                {periodos.data?.map((p) => (
                  <option key={p.id_periodo} value={p.id_periodo}>
                    {p.clave_periodo} {p.activo ? '(activo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre_grupo">
                Nombre del grupo
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
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="capacidad_maxima">
                Capacidad máxima (opcional)
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="capacidad_maxima"
                min={1}
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
                disabled={isSubmitting || !personal.data || !idPeriodo}
              >
                {isSubmitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </DashboardShell>
  )
}
