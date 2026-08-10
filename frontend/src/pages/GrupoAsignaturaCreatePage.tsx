import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAsignaturas, getGrupos, postGrupoAsignatura, type AsignaturaOut, type GrupoOut } from '@/api/academico'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPeriodosSemestrales, type PeriodoSemestralOut } from '@/api/organizacional'
import { getPersonal, getPersonalMe, type PersonalMe, type PersonalOut } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface FormData {
  grupos: GrupoOut[]
  asignaturas: AsignaturaOut[]
  periodos: PeriodoSemestralOut[]
  personal: PersonalOut[]
}

async function fetchFormData(): Promise<FormData> {
  const [grupos, asignaturas, periodos, personal] = await Promise.all([
    getGrupos(),
    getAsignaturas(),
    getPeriodosSemestrales(),
    getPersonal(),
  ])
  return { grupos, asignaturas, periodos, personal }
}

// docs/frontend/02-especificacion-contenido.md, ficha 15 (POST /grupo-asignatura):
// X, A pueden dar de alta. El selector de docente solo debe ofrecer
// Personal con rol='docente' y estatus='activo' -- GET /personal no
// expone un filtro por rol (app/domains/personal/router.py), así que se
// pide completo y se filtra en cliente (confirmado antes de construir
// esta pantalla, no se agregó filtro nuevo en el backend por YAGNI: es un
// solo consumidor).
//
// Dos rechazos del backend, ambos ya traducidos a 4xx claro (ver
// api/academico.ts::postGrupoAsignatura):
// - id_docente no es rol='docente' -> 400 (trigger fn_valida_rol_docente).
// - grupo+asignatura+periodo repetido -> 409 (uq_grupo_asignatura_periodo).
// Ambos llegan aquí como ApiError con mensaje ya claro, sin caso especial.
export function GrupoAsignaturaCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idGrupo, setIdGrupo] = useState('')
  const [idAsignatura, setIdAsignatura] = useState('')
  const [idDocente, setIdDocente] = useState('')
  const [idPeriodo, setIdPeriodo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  const docentes = useMemo(
    () => formData.data?.personal.filter((p) => p.rol === 'docente' && p.estatus === 'activo') ?? [],
    [formData.data],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      await postGrupoAsignatura({
        id_grupo: Number(idGrupo),
        id_asignatura: Number(idAsignatura),
        id_docente: Number(idDocente),
        id_periodo: Number(idPeriodo),
      })
      setSuccess('Asignación creada correctamente.')
      setIdGrupo('')
      setIdAsignatura('')
      setIdDocente('')
      setIdPeriodo('')
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para crear asignaciones.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear la asignación.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/grupo-asignatura')}
      greetingSubtitle="Asigna un docente a un grupo y materia en un periodo."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Nueva asignación</h2>

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
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_grupo">
                Grupo
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="id_grupo"
                required
                value={idGrupo}
                onChange={(e) => setIdGrupo(e.target.value)}
                disabled={isSubmitting || formData.loading}
              >
                <option value="" disabled>
                  Selecciona un grupo
                </option>
                {formData.data?.grupos.map((g) => (
                  <option key={g.id_grupo} value={g.id_grupo}>
                    {g.nombre_grupo}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_asignatura">
                Asignatura
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="id_asignatura"
                required
                value={idAsignatura}
                onChange={(e) => setIdAsignatura(e.target.value)}
                disabled={isSubmitting || formData.loading}
              >
                <option value="" disabled>
                  Selecciona una asignatura
                </option>
                {formData.data?.asignaturas.map((a) => (
                  <option key={a.id_asignatura} value={a.id_asignatura}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

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
                disabled={isSubmitting || formData.loading}
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
                disabled={isSubmitting || formData.loading}
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
                disabled={isSubmitting || !idGrupo || !idAsignatura || !idDocente || !idPeriodo}
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
