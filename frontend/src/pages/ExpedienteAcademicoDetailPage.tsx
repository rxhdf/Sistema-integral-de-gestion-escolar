import { useCallback, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getExpedienteAcademico, type ExpedienteAcademicoOut } from '@/api/alumnos'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

const SITUACION_LABEL: Record<ExpedienteAcademicoOut['situacion_academica'], string> = {
  regular: 'Regular',
  irregular: 'Irregular',
  condicionado: 'Condicionado',
}

// docs/frontend/02-especificacion-contenido.md, ficha 20
// (GET /expediente-academico/{id_alumno}): D (solo si el alumno está en su
// scope), X, A. Sin split de campos por rol -- matriz RBAC Nivel 3 confirma
// que docente ve el mismo promedio general que directivo/admin aquí. El 404
// cubre tanto "no existe" como "fuera de scope RLS", mismo patrón de
// opacidad que /alumno -- no se distingue el mensaje para no filtrar
// existencia.
export function ExpedienteAcademicoDetailPage() {
  const navigate = useNavigate()
  const { idAlumno } = useParams<{ idAlumno: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const fetchExpediente = useCallback(() => getExpedienteAcademico(Number(idAlumno)), [idAlumno])
  const expediente = useApiQuery<ExpedienteAcademicoOut>(fetchExpediente)

  useEffect(() => {
    if (personal.unauthorized || expediente.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, expediente.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  const puedeCrear = personal.data?.rol === 'directivo' || personal.data?.rol === 'admin'
  const esNotFound = expediente.error?.includes('no encontrado') ?? false

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Detalle del expediente académico."
      onLogout={handleLogout}
    >
      <section className="max-w-xl space-y-4">
        <Link className="font-label-md text-label-md text-primary hover:underline" to="/alumno">
          ← Volver a alumnos
        </Link>

        <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Expediente académico</h2>

        {expediente.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container space-y-3">
            <p className="font-label-md text-label-md font-bold">
              {esNotFound ? 'Expediente no encontrado' : 'No se pudo cargar el expediente'}
            </p>
            <p className="font-body-md text-body-md">{expediente.error}</p>
            {esNotFound && puedeCrear && (
              <Link
                className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
                to={`/expediente-academico/nuevo?id_alumno=${idAlumno}`}
              >
                Crear expediente para este alumno
              </Link>
            )}
          </div>
        ) : expediente.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-10 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : expediente.data ? (
          <>
            <dl className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 space-y-4">
              <div>
                <dt className="font-label-md text-label-md text-secondary">Situación académica</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">
                  {SITUACION_LABEL[expediente.data.situacion_academica]}
                </dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Escuela de procedencia</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">
                  {expediente.data.escuela_procedencia ?? 'Sin capturar'}
                </dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Promedio de secundaria</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">
                  {expediente.data.promedio_secundaria ?? 'Sin capturar'}
                </dd>
              </div>
              <div>
                <dt className="font-label-md text-label-md text-secondary">Promedio actual</dt>
                <dd className="font-body-lg text-body-lg text-on-surface">
                  {expediente.data.promedio_actual ?? 'Sin capturar'}
                </dd>
              </div>
            </dl>
            {puedeCrear && (
              <Link
                className="inline-flex items-center gap-xs py-sm px-md rounded-md font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant transition-colors min-h-[48px]"
                to={`/alumno/${idAlumno}/expediente-academico/editar`}
              >
                Editar expediente
              </Link>
            )}
          </>
        ) : null}
      </section>
    </DashboardShell>
  )
}
