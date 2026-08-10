import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { DashboardDocentePage } from '@/pages/DashboardDocentePage'
import { getDashboardResumen, isDashboardDocenteOut, type DashboardResumenOut } from '@/api/dashboard'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { KpiCard, KpiCardSkeleton } from '@/components/KpiCard'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

const QUICK_ACCESS_ITEMS = [
  { icon: 'person_search', title: 'Gestión de alumnos', description: 'Altas, bajas y expedientes' },
  { icon: 'assignment_ind', title: 'Gestión de personal', description: 'Docentes y administrativos' },
  { icon: 'account_tree', title: 'Estructura académica', description: 'Planes de estudio y grupos' },
  { icon: 'grading', title: 'Calificaciones', description: 'Consultar y corregir actas' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const resumen = useApiQuery<DashboardResumenOut>(getDashboardResumen)
  const personal = useApiQuery<PersonalMe>(getPersonalMe)

  useEffect(() => {
    if (resumen.unauthorized || personal.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [resumen.unauthorized, personal.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  // El backend elige la forma de /dashboard/resumen según el rol del JWT --
  // una vez que sabemos que es la forma de docente, delegamos a esa página
  // en vez de intentar renderizar KPIs de directivo con campos que no existen.
  if (resumen.data && isDashboardDocenteOut(resumen.data)) {
    return <DashboardDocentePage resumen={resumen.data} personal={personal.data} onLogout={handleLogout} />
  }

  const kpis = resumen.data
    ? [
        { icon: 'school', label: 'Matrícula Activa', value: resumen.data.matricula_total },
        { icon: 'group', label: 'Grupos Activos', value: resumen.data.grupos_activos },
        { icon: 'badge', label: 'Personal Activo', value: resumen.data.personal_activo },
        { icon: 'menu_book', label: 'Materias Config.', value: resumen.data.asignaturas_configuradas },
      ]
    : []

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/dashboard')}
      greetingSubtitle="Aquí está el resumen general de la institución para hoy."
      onLogout={handleLogout}
    >
      {resumen.error ? (
        <section role="alert" className="bg-error-container border border-error rounded-xl p-6 text-on-error-container">
          <p className="font-label-md text-label-md font-bold mb-1">No se pudo cargar el resumen</p>
          <p className="font-body-md text-body-md">{resumen.error}</p>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {resumen.loading
            ? Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
            : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <section className="lg:col-span-2 space-y-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface border-b border-surface-variant pb-2">
            Acceso Rápido
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUICK_ACCESS_ITEMS.map((item) => (
              <button
                key={item.title}
                className="flex items-center gap-4 p-4 bg-surface-container-lowest border border-surface-variant rounded-lg hover:border-primary hover:shadow-[0_0_0_1px_rgba(181,0,11,1)] transition-all text-left group"
                type="button"
              >
                <div className="p-3 bg-surface-container rounded-full group-hover:bg-primary-fixed transition-colors">
                  <span className="material-symbols-outlined text-secondary group-hover:text-primary">
                    {item.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-label-md font-label-md font-bold text-on-surface">{item.title}</h3>
                  <p className="text-label-sm font-label-sm text-secondary">{item.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Ciclo escolar: X, A (docs/frontend/02-especificacion-contenido.md,
            ficha 4) -- docente nunca ve esta entrada. */}
        {(personal.data?.rol === 'directivo' || personal.data?.rol === 'admin') && (
          <section className="space-y-6">
            <h2 className="text-headline-md font-headline-md font-bold text-on-surface border-b border-surface-variant pb-2">
              Ciclo escolar
            </h2>
            <Link
              className="flex items-center gap-4 p-4 bg-surface-container-lowest border border-surface-variant rounded-lg hover:border-primary hover:shadow-[0_0_0_1px_rgba(181,0,11,1)] transition-all text-left group"
              to="/ciclo-escolar"
            >
              <div className="p-3 bg-surface-container rounded-full group-hover:bg-primary-fixed transition-colors">
                <span className="material-symbols-outlined text-secondary group-hover:text-primary">event</span>
              </div>
              <div>
                <h3 className="text-label-md font-label-md font-bold text-on-surface">Ciclos escolares</h3>
                <p className="text-label-sm font-label-sm text-secondary">Consultar y registrar ciclos escolares</p>
              </div>
            </Link>
          </section>
        )}

        {/* Panel Directivo: solo admin -- matriz RBAC, no directivo/docente */}
        {personal.data?.rol === 'admin' && (
          <section className="space-y-6">
            <h2 className="text-headline-md font-headline-md font-bold text-on-surface border-b border-surface-variant pb-2">
              Panel Directivo
            </h2>
            <div className="bg-surface-container-highest p-6 rounded-xl border border-outline-variant relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-fixed-dim rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4 text-primary">
                  <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                  <h3 className="text-body-lg font-body-lg font-bold">Gestión de cuentas</h3>
                </div>
                <p className="text-body-md font-body-md text-on-surface-variant mb-6">
                  Administre los roles, permisos y accesos del personal operativo del plantel.
                </p>
                <button
                  className="w-full bg-primary text-on-primary py-3 px-4 rounded-lg font-label-md font-bold hover:bg-on-primary-fixed-variant transition-colors flex items-center justify-center gap-2"
                  type="button"
                >
                  Acceder al panel
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
