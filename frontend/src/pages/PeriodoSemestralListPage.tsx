import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import {
  getCiclosEscolares,
  getPeriodosSemestrales,
  putPeriodoSemestralActivo,
  type CicloEscolarOut,
  type PeriodoSemestralOut,
} from '@/api/organizacional'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, fichas 5 y 7: listado +
// activar/desactivar viven en la misma pantalla (el toggle es por fila, no
// un formulario aparte -- PeriodoSemestralUpdate solo tiene `activo`).
// Confirmado con el backend real (repository.py::set_periodo_semestral_activo):
// activar un periodo desactiva automáticamente cualquier otro que estuviera
// activo, en la misma transacción -- nunca hay 409 desde este endpoint,
// a diferencia del alta (ficha 6).
export function PeriodoSemestralListPage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const periodos = useApiQuery<PeriodoSemestralOut[]>(getPeriodosSemestrales)
  const ciclos = useApiQuery<CicloEscolarOut[]>(getCiclosEscolares)

  const [rows, setRows] = useState<PeriodoSemestralOut[] | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  useEffect(() => {
    if (periodos.data) setRows(periodos.data)
  }, [periodos.data])

  useEffect(() => {
    if (personal.unauthorized || periodos.unauthorized || ciclos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, periodos.unauthorized, ciclos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeEscribir = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'

  function nombreCiclo(idCiclo: number): string {
    return ciclos.data?.find((c) => c.id_ciclo === idCiclo)?.nombre ?? `Ciclo ${idCiclo}`
  }

  async function toggleActivo(periodo: PeriodoSemestralOut) {
    setError(null)
    setAnnouncement(null)
    setPendingId(periodo.id_periodo)
    const nuevoActivo = !periodo.activo
    try {
      const actualizado = await putPeriodoSemestralActivo(periodo.id_periodo, nuevoActivo)
      setRows((prev) =>
        prev
          ? prev.map((p) => {
              if (p.id_periodo === actualizado.id_periodo) return actualizado
              // Activar uno desactiva cualquier otro activo en la misma
              // transacción del backend -- reflejamos eso aquí sin volver
              // a pedir todo el listado.
              return nuevoActivo && p.activo ? { ...p, activo: false } : p
            })
          : prev,
      )
      setAnnouncement(`Periodo ${actualizado.clave_periodo} ${nuevoActivo ? 'activado' : 'desactivado'}.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para cambiar el estado de este periodo.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar el periodo.')
      }
    } finally {
      setPendingId(null)
    }
  }

  const loading = periodos.loading || ciclos.loading

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/periodo-semestral')}
      greetingSubtitle="Consulta y activa los periodos semestrales."
      onLogout={handleLogout}
    >
      <section className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Periodos semestrales</h2>
          {puedeEscribir && (
            <Link
              className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
              to="/periodo-semestral/nuevo"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nuevo periodo semestral
            </Link>
          )}
        </div>

        {puedeEscribir && (
          <p className="text-label-sm font-label-sm text-secondary">
            Solo un periodo puede estar activo a la vez: activar uno desactiva automáticamente el que lo estaba.
          </p>
        )}

        <div aria-live="polite">
          {announcement && (
            <div className="rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
              {announcement}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {error}
            </div>
          )}
        </div>

        {periodos.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el listado</p>
            <p className="font-body-md text-body-md">{periodos.error}</p>
          </div>
        ) : loading ? (
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
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Clave</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Ciclo</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">No.</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Inicio</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Fin</th>
                  <th scope="col" className="p-4 text-label-md font-label-md text-secondary">Estado</th>
                  {puedeEscribir && <th scope="col" className="p-4 text-label-md font-label-md text-secondary" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((periodo) => (
                  <tr key={periodo.id_periodo} className="border-t border-surface-variant">
                    <td className="p-4 text-body-md font-body-md text-on-surface">{periodo.clave_periodo}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{nombreCiclo(periodo.id_ciclo)}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{periodo.numero_periodo}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{periodo.fecha_inicio}</td>
                    <td className="p-4 text-body-md font-body-md text-on-surface">{periodo.fecha_fin}</td>
                    <td className="p-4">
                      <span
                        className={
                          periodo.activo
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-green-100 text-green-800'
                            : 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-label-sm font-label-sm bg-surface-container text-secondary'
                        }
                      >
                        {periodo.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {puedeEscribir && (
                      <td className="p-4">
                        <button
                          type="button"
                          className="min-h-[44px] min-w-[44px] px-sm py-xs rounded-md border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={pendingId === periodo.id_periodo}
                          onClick={() => toggleActivo(periodo)}
                        >
                          {pendingId === periodo.id_periodo ? '…' : periodo.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body-md font-body-md text-secondary">Aún no hay periodos semestrales registrados.</p>
        )}
      </section>
    </DashboardShell>
  )
}
