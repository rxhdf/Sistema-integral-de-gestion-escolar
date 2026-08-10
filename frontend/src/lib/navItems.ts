import type { PersonalMe } from '@/api/personal'
import type { NavItem } from '@/components/DashboardShell'

// Única fuente de verdad del nav -- antes cada página tenía su propio
// NAV_ITEMS estático y era fácil olvidar filtrar por rol en alguna (pasó
// con Ciclo escolar). Setup institucional (Ciclo escolar, Periodo
// semestral) es X/A únicamente. "Personal" también es X/A -- pero a
// diferencia de esos, aquí X (directivo) solo tiene R, no C (matriz RBAC
// Nivel 1); el botón de alta se oculta dentro de la propia página, no en
// el nav (el nav solo decide "ve el listado sí/no").
export function buildNavItems(rol: PersonalMe['rol'] | undefined, activeHref: string): NavItem[] {
  const esDirectivoOAdmin = rol === 'directivo' || rol === 'admin'
  const items: NavItem[] = [
    { icon: 'dashboard', label: 'Dashboard', active: activeHref === '/dashboard', href: '/dashboard' },
  ]
  if (esDirectivoOAdmin) {
    items.push(
      { icon: 'event', label: 'Ciclo escolar', active: activeHref === '/ciclo-escolar', href: '/ciclo-escolar' },
      {
        icon: 'calendar_month',
        label: 'Periodo semestral',
        active: activeHref === '/periodo-semestral',
        href: '/periodo-semestral',
      },
    )
  }
  items.push({ icon: 'person_search', label: 'Alumnos', active: false })
  if (esDirectivoOAdmin) {
    items.push({
      icon: 'assignment_ind',
      label: 'Personal',
      active: activeHref === '/personal',
      href: '/personal',
    })
  }
  items.push(
    { icon: 'account_tree', label: 'Académico', active: false },
    {
      icon: 'grading',
      label: 'Calificaciones',
      active: activeHref === '/calificacion',
      href: '/calificacion',
    },
  )
  return items
}
