import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getCiclosEscolares, postPeriodoSemestral, type CicloEscolarOut } from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 6 (POST /periodo-semestral):
// X, A pueden dar de alta. A diferencia de Ciclo_Escolar (ficha 4), aquí NO
// hay lógica que desactive el otro periodo activo automáticamente -- el 409
// de uq_periodo_semestral_activo rechaza la operación tal cual, y el
// mensaje del backend ya dice qué hacer, se relaya sin reescribirlo.
export function PeriodoSemestralCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const ciclos = useApiQuery<CicloEscolarOut[]>(getCiclosEscolares)

  const [idCiclo, setIdCiclo] = useState('')
  const [clavePeriodo, setClavePeriodo] = useState('')
  const [numeroPeriodo, setNumeroPeriodo] = useState<'1' | '2'>('1')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [activo, setActivo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || ciclos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, ciclos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const periodo = await postPeriodoSemestral({
        id_ciclo: Number(idCiclo),
        clave_periodo: clavePeriodo,
        numero_periodo: numeroPeriodo === '1' ? 1 : 2,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        activo,
      })
      setSuccess(`Periodo semestral "${periodo.clave_periodo}" creado correctamente.`)
      setClavePeriodo('')
      setFechaInicio('')
      setFechaFin('')
      setActivo(false)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para crear periodos semestrales.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear el periodo semestral.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/periodo-semestral')}
      greetingSubtitle="Registra un nuevo periodo semestral."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">
            Alta de periodo semestral
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

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_ciclo">
                Ciclo escolar
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="id_ciclo"
                required
                value={idCiclo}
                onChange={(e) => setIdCiclo(e.target.value)}
                disabled={isSubmitting || ciclos.loading}
              >
                <option value="" disabled>
                  Selecciona un ciclo
                </option>
                {ciclos.data?.map((ciclo) => (
                  <option key={ciclo.id_ciclo} value={ciclo.id_ciclo}>
                    {ciclo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="clave_periodo">
                Clave del periodo
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="clave_periodo"
                maxLength={10}
                required
                type="text"
                value={clavePeriodo}
                onChange={(e) => setClavePeriodo(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="numero_periodo">
                Número de periodo
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="numero_periodo"
                required
                value={numeroPeriodo}
                onChange={(e) => setNumeroPeriodo(e.target.value as '1' | '2')}
                disabled={isSubmitting}
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_inicio">
                Fecha de inicio
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="fecha_inicio"
                required
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_fin">
                Fecha de fin
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="fecha_fin"
                required
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center">
              <input
                className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded bg-surface"
                id="activo"
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                disabled={isSubmitting}
              />
              <label className="ml-2 block font-label-md text-label-md text-on-surface-variant" htmlFor="activo">
                Activo
              </label>
            </div>
            {activo && (
              <p className="text-label-sm font-label-sm text-secondary">
                Si ya hay otro periodo semestral activo, esta alta será rechazada -- desactívalo primero desde el
                listado.
              </p>
            )}

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
        </div>
      </section>
    </DashboardShell>
  )
}
