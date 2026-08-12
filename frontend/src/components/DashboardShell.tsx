import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import cobaoLogo from '@/assets/images/cobao_logo.svg'
import type { PersonalMe } from '@/api/personal'
import { getInitials } from '@/lib/initials'

export interface NavItem {
  icon: string
  label: string
  active: boolean
  // Sin href: placeholder inerte para un dominio todavía sin pantalla
  // construida (ej. "Alumnos", "Personal") -- no ofrecer un link que
  // sabemos que no lleva a ningún lado.
  href?: string
}

interface DashboardShellProps {
  personal: PersonalMe | null
  navItems: NavItem[]
  greetingSubtitle: string
  onLogout: () => void
  children: ReactNode
}

// Header + sidebar compartidos entre los dashboards de directivo/admin y de
// docente -- mismo marco visual, el contenido (KPIs, accesos, listas) lo da
// cada página vía children.
export function DashboardShell({ personal, navItems, greetingSubtitle, onLogout, children }: DashboardShellProps) {
  return (
    <div className="bg-background text-on-background min-h-screen font-body-md">
      <header className="bg-surface-container-lowest border-b border-surface-variant flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop h-16 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="text-headline-md font-headline-md font-bold text-primary">SIGE Portal</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 h-full">
          {navItems.map((item) => {
            const className = item.active
              ? 'h-full flex items-center text-primary border-b-2 border-primary font-bold px-2'
              : 'h-full flex items-center text-secondary hover:text-primary transition-colors px-2'
            return item.href ? (
              <Link key={item.label} className={className} to={item.href}>
                {item.label}
              </Link>
            ) : (
              <span key={item.label} className={`${className} cursor-default`}>
                {item.label}
              </span>
            )
          })}
        </nav>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pl-4 border-l border-surface-variant">
            {personal && (
              <Link
                className="flex items-center gap-3 rounded-md hover:bg-surface-container-high transition-colors p-1 -m-1"
                to="/perfil"
                aria-label="Ver mi perfil"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-label-md font-label-md">
                    {personal.nombre} {personal.apellido_paterno}
                  </div>
                  <div className="text-label-sm font-label-sm text-secondary capitalize">{personal.rol}</div>
                </div>
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed-variant border border-surface-variant flex items-center justify-center text-label-sm font-label-sm font-bold"
                >
                  {getInitials(personal.nombre, personal.apellido_paterno)}
                </div>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className="hidden lg:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-64 flex-col border-r border-surface-variant bg-surface">
          <div className="p-6 border-b border-surface-variant">
            <div className="flex items-center gap-3 mb-4">
              <img alt="Logo COBAO" className="w-10 h-10 object-contain" src={cobaoLogo} />
              <div>
                <h2 className="text-label-md font-label-md font-bold text-on-surface">SIGE Portal</h2>
                <p className="text-label-sm font-label-sm text-secondary">Educación pública de calidad</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {navItems.map((item) => {
              const className = item.active
                ? 'flex items-center gap-3 px-6 py-3 text-primary font-bold border-r-4 border-primary bg-surface-container mb-1'
                : 'flex items-center gap-3 px-6 py-3 text-secondary hover:bg-surface-container-high transition-colors mb-1'
              const content = (
                <>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="text-label-md font-label-md">{item.label}</span>
                </>
              )
              return item.href ? (
                <Link key={item.label} className={className} to={item.href}>
                  {content}
                </Link>
              ) : (
                <span key={item.label} className={`${className} cursor-default`}>
                  {content}
                </span>
              )
            })}
          </nav>
          <div className="p-4 border-t border-surface-variant">
            <a
              className="flex items-center gap-3 px-4 py-2 text-secondary hover:bg-surface-container-high transition-colors rounded-lg mb-1"
              href="#"
            >
              <span className="material-symbols-outlined">help_outline</span>
              <span className="text-label-md font-label-md">Centro de ayuda</span>
            </a>
            <button
              className="w-full flex items-center gap-3 px-4 py-2 text-primary hover:bg-error-container transition-colors rounded-lg text-left"
              onClick={onLogout}
              type="button"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-label-md font-label-md">Cerrar sesión</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto lg:ml-64 bg-surface-bright">
          <div className="max-w-7xl mx-auto p-margin-mobile md:p-margin-desktop space-y-lg">
            <section>
              <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg font-bold text-on-surface">
                Buen día{personal ? `, ${personal.nombre}` : ''}.
              </h1>
              <p className="text-body-lg font-body-lg text-secondary mt-2">{greetingSubtitle}</p>
            </section>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
