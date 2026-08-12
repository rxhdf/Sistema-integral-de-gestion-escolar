import { useCallback, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getAsistenciaResumen, type AsistenciaResumenOut } from '@/api/asistencia'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/data_dictionary/asistencia.md, "Decisiones resueltas" #2: agregado
// calculado al vuelo, no persistido. D, X, A -- mismo scope de fila que
// asistencia_select: el resumen de un docente solo cuenta las sesiones de
// SUS grupo_asignatura, no el historial completo del alumno si tiene
// otras materias con otros docentes (X/A sí ven el total real).
export function AsistenciaResumenPage() {
  const navigate = useNavigate()
  const { idAlumno } = useParams<{ idAlumno: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const fetchResumen = useCallback(() => getAsistenciaResumen(Number(idAlumno)), [idAlumno])
  const resumen = useApiQuery<AsistenciaResumenOut>(fetchResumen)

  useEffect(() => {
    if (personal.unauthorized || resumen.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, resumen.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Resumen de asistencia del alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-xl space-y-4">
        <Link className="font-label-md text-label-md text-primary hover:underline" to="/alumno">
          ← Volver a alumnos
        </Link>

        <h2 className="text-headline-md font-headline-md font-bold text-on-surface">Resumen de asistencia</h2>

        {resumen.error ? (
          <div role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
            <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el resumen</p>
            <p className="font-body-md text-body-md">{resumen.error}</p>
          </div>
        ) : resumen.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} aria-hidden="true" className="h-14 bg-surface-container animate-pulse rounded-lg" />
            ))}
          </div>
        ) : resumen.data ? (
          <div className="grid grid-cols-2 gap-sm">
            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <p className="font-label-md text-label-md text-secondary">Presente</p>
              <p className="text-headline-md font-headline-md font-bold text-on-surface">{resumen.data.presente}</p>
            </div>
            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <p className="font-label-md text-label-md text-secondary">Ausente</p>
              <p className="text-headline-md font-headline-md font-bold text-on-surface">{resumen.data.ausente}</p>
            </div>
            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <p className="font-label-md text-label-md text-secondary">Retardo</p>
              <p className="text-headline-md font-headline-md font-bold text-on-surface">{resumen.data.retardo}</p>
            </div>
            <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
              <p className="font-label-md text-label-md text-secondary">Total de sesiones</p>
              <p className="text-headline-md font-headline-md font-bold text-on-surface">{resumen.data.total}</p>
            </div>
          </div>
        ) : null}
      </section>
    </DashboardShell>
  )
}
