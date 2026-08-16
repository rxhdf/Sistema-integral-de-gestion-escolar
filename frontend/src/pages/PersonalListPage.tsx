import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonal, getPersonalMe, putPersonal, type PersonalMe, type PersonalOut } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 9 (GET /personal):
// X, A pueden consultar (matriz RBAC Nivel 1: directivo solo R, sin
// crear/editar/dar de baja) -- el botón de alta (ficha 8) es admin
// únicamente, distinto del patrón de Ciclo/Periodo donde X y A comparten
// las mismas acciones.
export function PersonalListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const listado = useApiQuery<PersonalOut[]>(getPersonal)

  const [rows, setRows] = useState<PersonalOut[] | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    if (listado.data) setRows(listado.data)
  }, [listado.data])

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

  const puedeCrear = personal.data?.rol === 'admin'
  const puedeEditar = personal.data?.rol === 'admin'

  // Gestión de Cuentas Pieza 2: acceso rápido de bloqueo/desbloqueo por
  // fila, mismo patrón que el activar/desactivar de
  // PeriodoSemestralListPage.tsx -- solo para 'activo'/'bloqueado', nunca
  // para 'baja' (permanente, no forma parte de este toggle reversible).
  async function toggleBloqueado(p: PersonalOut) {
    setToggleError(null)
    setAnnouncement(null)
    setPendingId(p.id_personal)
    const nuevoEstatus = p.estatus === 'bloqueado' ? 'activo' : 'bloqueado'
    try {
      const actualizado = await putPersonal(p.id_personal, { estatus: nuevoEstatus })
      setRows((prev) => (prev ? prev.map((row) => (row.id_personal === actualizado.id_personal ? actualizado : row)) : prev))
      setAnnouncement(
        `${actualizado.nombre} ${actualizado.apellido_paterno} ${nuevoEstatus === 'bloqueado' ? 'bloqueado' : 'desbloqueado'}.`,
      )
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setToggleError('No tienes permiso para cambiar el estado de esta cuenta.')
      } else if (err instanceof ApiError) {
        setToggleError(err.message)
      } else {
        setToggleError('No se pudo actualizar el estatus.')
      }
    } finally {
      setPendingId(null)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/personal')}
      greetingSubtitle="Consulta el personal del plantel."
      onLogout={handleLogout}
    >
      <section className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Personal</h2>
          {puedeCrear && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/personal/nuevo"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo personal
            </Link>
          )}
        </div>

        {puedeEditar && (
          <div aria-live="polite">
            {announcement && (
              <div className="rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                {announcement}
              </div>
            )}
            {toggleError && (
              <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                {toggleError}
              </div>
            )}
          </div>
        )}

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
        ) : rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-surface-container text-left">
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Nombre</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Correo</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Rol</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estatus</th>
                  {puedeEditar && <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id_personal} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">
                      {p.nombre} {p.apellido_paterno} {p.apellido_materno ?? ''}
                    </td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{p.email_institucional}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface capitalize">{p.rol}</td>
                    <td className="p-4">
                      <span
                        className={
                          p.estatus === 'activo'
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                            : p.estatus === 'bloqueado'
                              ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-error-container text-on-error-container'
                              : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-surface-container text-secondary'
                        }
                      >
                        {p.estatus}
                      </span>
                    </td>
                    {puedeEditar && (
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link
                            className="min-h-[44px] inline-flex items-center px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container"
                            to={`/personal/${p.id_personal}/editar`}
                          >
                            Editar
                          </Link>
                          {p.estatus !== 'baja' && (
                            <button
                              type="button"
                              className="min-h-[44px] px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container disabled:opacity-60 disabled:cursor-not-allowed"
                              disabled={pendingId === p.id_personal}
                              onClick={() => toggleBloqueado(p)}
                            >
                              {pendingId === p.id_personal ? '…' : p.estatus === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">No hay personal registrado.</p>
        )}
      </section>
    </DashboardShell>
  )
}
