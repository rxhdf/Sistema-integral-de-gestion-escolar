import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPlantel, putPlantel, type PlantelOut } from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, fichas 30-31
// (GET/PUT /plantel): D solo lectura; X, A pueden editar. Una sola
// pantalla para las dos fichas -- es la única fila del MVP (sin {id} en
// el path del PUT, mismo razonamiento que el backend), no hay lista que
// justifique separar detalle de edición como en las demás entidades.
// GET /plantel devuelve list[PlantelOut] de 1 elemento; se toma el
// primero. Sin riesgo de 409: solo hay 1 fila, un UPDATE no puede
// colisionar consigo mismo.
export function PlantelPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const plantelList = useApiQuery<PlantelOut[]>(getPlantel)

  const [clavePlantel, setClavePlantel] = useState('')
  const [nombrePlantel, setNombrePlantel] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [estado, setEstado] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [estatus, setEstatus] = useState('activo')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const plantel = plantelList.data?.[0]
  const puedeEditar = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'

  useEffect(() => {
    if (personal.unauthorized || plantelList.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (plantel && !initialized) {
      setClavePlantel(plantel.clave_plantel)
      setNombrePlantel(plantel.nombre_plantel)
      setMunicipio(plantel.municipio)
      setEstado(plantel.estado)
      setDomicilio(plantel.domicilio ?? '')
      setTelefono(plantel.telefono ?? '')
      setEmail(plantel.email ?? '')
      setEstatus(plantel.estatus)
      setInitialized(true)
    }
  }, [personal.unauthorized, plantelList.unauthorized, plantel, initialized, navigate])

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
      const actualizado = await putPlantel({
        clave_plantel: clavePlantel,
        nombre_plantel: nombrePlantel,
        municipio,
        estado,
        domicilio: domicilio || null,
        telefono: telefono || null,
        email: email || null,
        estatus,
      })
      setSuccess(`Plantel "${actualizado.nombre_plantel}" actualizado correctamente.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar el plantel.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar el plantel.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/plantel')}
      greetingSubtitle="Consulta y edita los datos del plantel."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Plantel</h2>

          {plantelList.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : plantelList.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {plantelList.error}
            </div>
          ) : !plantel ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Plantel no encontrado.
            </div>
          ) : puedeEditar ? (
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
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="clave_plantel">
                    Clave
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="clave_plantel"
                    maxLength={20}
                    required
                    type="text"
                    value={clavePlantel}
                    onChange={(e) => setClavePlantel(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre_plantel">
                    Nombre
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="nombre_plantel"
                    maxLength={200}
                    required
                    type="text"
                    value={nombrePlantel}
                    onChange={(e) => setNombrePlantel(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="municipio">
                    Municipio
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="municipio"
                    maxLength={100}
                    required
                    type="text"
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="estado">
                    Estado
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="estado"
                    maxLength={80}
                    required
                    type="text"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="domicilio">
                    Domicilio
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="domicilio"
                    maxLength={300}
                    type="text"
                    value={domicilio}
                    onChange={(e) => setDomicilio(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="telefono">
                    Teléfono
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="telefono"
                    maxLength={20}
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="email">
                    Email
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="email"
                    maxLength={100}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="estatus">
                    Estatus
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="estatus"
                    value={estatus}
                    onChange={(e) => setEstatus(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
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
          ) : (
            <dl className="space-y-4">
              <div>
                <dt className="font-label-md text-label-md text-secondary">Clave</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.clave_plantel}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Nombre</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.nombre_plantel}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Municipio</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.municipio}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Estado</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.estado}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Domicilio</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.domicilio ?? 'Sin capturar'}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Teléfono</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.telefono ?? 'Sin capturar'}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Email</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">{plantel.email ?? 'Sin capturar'}</dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Estatus</dt>
                <dd className="font-body-lg text-body-lg text-on-surface capitalize">{plantel.estatus}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>
    </DashboardShell>
  )
}
