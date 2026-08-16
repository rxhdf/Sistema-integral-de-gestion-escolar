import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getLogAcceso, type LogAccesoOut } from '@/api/logAcceso'
import {
  getPersonal,
  getPersonalMe,
  putPersonal,
  putPersonalResetPassword,
  type EstatusPersonal,
  type PersonalMe,
  type PersonalOut,
} from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// Gestión de Cuentas Pieza 3: los 3 motivos posibles de
// app/domains/log_acceso (ver docs/data_dictionary/gestion-cuentas.md) --
// mapeo a texto legible, con fallback al valor crudo si apareciera uno
// nuevo que este mapa no conoce todavía.
const MOTIVO_FALLO_LABEL: Record<string, string> = {
  credenciales_invalidas: 'Credenciales inválidas',
  cuenta_bloqueada: 'Cuenta bloqueada',
  cuenta_baja: 'Cuenta dada de baja',
}

// docs/frontend/02-especificacion-contenido.md, ficha 24 (PUT /personal/{id}):
// A únicamente. curp/email_institucional/id_plantel no son editables aquí
// (fuera de alcance a propósito, ver PersonalUpdate). Mismo patrón que
// CalificacionCorrectPage: sin GET por id, se busca en el listado ya
// pedido por PersonalListPage (GET /personal).
export function PersonalEditPage() {
  const navigate = useNavigate()
  const { idPersonal } = useParams<{ idPersonal: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const listado = useApiQuery<PersonalOut[]>(getPersonal)

  const [nombre, setNombre] = useState('')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [rol, setRol] = useState<'docente' | 'directivo' | 'admin'>('docente')
  const [estatus, setEstatus] = useState<EstatusPersonal>('activo')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Gestión de Cuentas Pieza 1: sección aparte de la edición general --
  // no comparte error/success con handleSubmit para que resetear la
  // contraseña no pise (ni sea pisado por) el mensaje del formulario
  // principal.
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const registro = listado.data?.find((p) => p.id_personal === Number(idPersonal))
  const esAdmin = personal.data?.rol === 'admin'

  const fetchLogAcceso = useCallback(() => getLogAcceso(Number(idPersonal)), [idPersonal])
  const logAcceso = useApiQuery<LogAccesoOut[]>(fetchLogAcceso)

  useEffect(() => {
    if (personal.unauthorized || listado.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (listado.data && !initialized) {
      if (!registro) {
        setNotFound(true)
      } else {
        setNombre(registro.nombre)
        setApellidoPaterno(registro.apellido_paterno)
        setApellidoMaterno(registro.apellido_materno ?? '')
        setTelefono(registro.telefono ?? '')
        setFechaIngreso(registro.fecha_ingreso ?? '')
        setRol(registro.rol)
        setEstatus(registro.estatus)
      }
      setInitialized(true)
    }
  }, [personal.unauthorized, listado.unauthorized, listado.data, registro, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idPersonal) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const actualizado = await putPersonal(Number(idPersonal), {
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno || null,
        telefono: telefono || null,
        fecha_ingreso: fechaIngreso || null,
        rol,
        estatus,
      })
      setSuccess(`Personal "${actualizado.nombre} ${actualizado.apellido_paterno}" actualizado correctamente.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar personal.')
      } else if (err instanceof ApiError && err.message.includes('no encontrado')) {
        setNotFound(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar el registro de personal.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idPersonal) return
    setResetError(null)
    setResetSuccess(null)
    setResetSubmitting(true)
    try {
      const actualizado = await putPersonalResetPassword(Number(idPersonal), nuevaPassword)
      setResetSuccess(`Contraseña actualizada para ${actualizado.nombre} ${actualizado.apellido_paterno}.`)
      setNuevaPassword('')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setResetError('No tienes permiso para restablecer contraseñas.')
      } else if (err instanceof ApiError) {
        setResetError(err.message)
      } else {
        setResetError('No se pudo restablecer la contraseña.')
      }
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/personal')}
      greetingSubtitle="Edita un registro de personal."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Edición de personal</h2>

          {listado.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : listado.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {listado.error}
            </div>
          ) : notFound ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Registro de personal no encontrado.
            </div>
          ) : (
            <>
              {/* Cambiar rol o estatus puede revocar el acceso de otra
                  persona en vivo -- assertive (ficha 24). */}
              <div aria-live="assertive">
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
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre">
                    Nombre
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="nombre"
                    maxLength={80}
                    required
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="apellido_paterno">
                    Apellido paterno
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="apellido_paterno"
                    maxLength={60}
                    required
                    type="text"
                    value={apellidoPaterno}
                    onChange={(e) => setApellidoPaterno(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="apellido_materno">
                    Apellido materno
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="apellido_materno"
                    maxLength={60}
                    type="text"
                    value={apellidoMaterno}
                    onChange={(e) => setApellidoMaterno(e.target.value)}
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
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_ingreso">
                    Fecha de ingreso
                  </label>
                  <input
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="fecha_ingreso"
                    type="date"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="rol">
                    Rol
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="rol"
                    value={rol}
                    onChange={(e) => setRol(e.target.value as 'docente' | 'directivo' | 'admin')}
                    disabled={isSubmitting}
                  >
                    <option value="docente">Docente</option>
                    <option value="directivo">Directivo</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="estatus">
                    Estatus
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="estatus"
                    value={estatus}
                    onChange={(e) => setEstatus(e.target.value as EstatusPersonal)}
                    disabled={isSubmitting}
                  >
                    <option value="activo">Activo</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="baja">Baja</option>
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

        {/* Gestión de Cuentas Pieza 1: solo admin -- gate explícito en el
            cliente, no solo el 403 del backend, para que directivo (que sí
            llega a esta página vía URL directa, matriz RBAC Nivel 1: R
            sobre Personal) nunca vea esta sección. */}
        {esAdmin && !listado.loading && !listado.error && !notFound && (
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 mt-6">
            <div className="flex items-center justify-between gap-sm">
              <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Restablecer contraseña</h2>
              {!showResetPassword && (
                <button
                  type="button"
                  className="min-h-[44px] px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                  onClick={() => setShowResetPassword(true)}
                >
                  Restablecer contraseña
                </button>
              )}
            </div>

            {showResetPassword && (
              <>
                <div aria-live="assertive">
                  {resetError && (
                    <div className="mt-4 rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                      {resetError}
                    </div>
                  )}
                  {resetSuccess && (
                    <div className="mt-4 rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                      {resetSuccess}
                    </div>
                  )}
                </div>

                <form className="space-y-md mt-4" onSubmit={handleResetPassword}>
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface block" htmlFor="nueva_password">
                      Nueva contraseña
                    </label>
                    <input
                      className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                      id="nueva_password"
                      minLength={8}
                      required
                      type="password"
                      autoComplete="new-password"
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      disabled={resetSubmitting}
                    />
                  </div>
                  <div className="flex gap-sm">
                    <button
                      className="flex-1 flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={resetSubmitting}
                    >
                      {resetSubmitting ? 'Restableciendo…' : 'Restablecer'}
                    </button>
                    <button
                      type="button"
                      className="min-h-[48px] px-md rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={() => {
                        setShowResetPassword(false)
                        setNuevaPassword('')
                        setResetError(null)
                      }}
                      disabled={resetSubmitting}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* Gestión de Cuentas Pieza 3: historial de accesos, solo admin,
            mismo criterio de gate explícito que la sección anterior. */}
        {esAdmin && !listado.loading && !listado.error && !notFound && (
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 mt-6">
            <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Historial de accesos</h2>
            {logAcceso.error ? (
              <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                {logAcceso.error}
              </div>
            ) : logAcceso.loading ? (
              <div aria-hidden="true" className="h-24 bg-surface-container animate-pulse rounded-lg" />
            ) : logAcceso.data && logAcceso.data.length > 0 ? (
              <ul className="space-y-3">
                {logAcceso.data.map((log) => (
                  <li key={log.id_log} className="border-t border-surface-variant pt-3 first:border-t-0 first:pt-0 flex items-center justify-between gap-sm">
                    <div>
                      <p className="font-body-md text-body-md text-on-surface">{log.fecha_intento}</p>
                      {!log.exitoso && log.motivo_fallo && (
                        <p className="font-label-sm text-label-sm text-secondary">
                          {MOTIVO_FALLO_LABEL[log.motivo_fallo] ?? log.motivo_fallo}
                        </p>
                      )}
                    </div>
                    <span
                      className={
                        log.exitoso
                          ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                          : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-error-container text-on-error-container'
                      }
                    >
                      {log.exitoso ? 'Exitoso' : 'Fallido'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-md font-body-md text-secondary">Sin intentos de acceso registrados.</p>
            )}
          </div>
        )}
      </section>
    </DashboardShell>
  )
}
