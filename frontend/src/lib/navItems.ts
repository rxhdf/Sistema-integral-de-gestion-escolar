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
    // Plantel: igual que Alumnos, docente tiene R (matriz RBAC Nivel 1) --
    // visible a los 3 roles. Fichas 30-31, sin nav propio hasta esta
    // entrega (PlantelPage.tsx combina detalle+edición en una pantalla).
    { icon: 'business', label: 'Plantel', active: activeHref === '/plantel', href: '/plantel' },
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
  // Alumnos: a diferencia de Grupo/Asignatura/Personal, docente sí tiene R
  // aquí (matriz RBAC Nivel 1) -- visible a los 3 roles, no solo X/A.
  items.push({ icon: 'person_search', label: 'Alumnos', active: activeHref === '/alumno', href: '/alumno' })
  if (esDirectivoOAdmin) {
    items.push({
      icon: 'assignment_ind',
      label: 'Personal',
      active: activeHref === '/personal',
      href: '/personal',
    })
    // docs/data_dictionary/perfil-analisis-alumno.md: exclusivo de
    // directivo/admin -- docente no tiene este caso de uso, se descartó
    // explícitamente en el diseño.
    items.push({
      icon: 'manage_search',
      label: 'Análisis de alumno',
      active: activeHref === '/alumno/buscar',
      href: '/alumno/buscar',
    })
  }
  // Académico (Grupo/Asignatura/Grupo_Asignatura): mismo criterio que Ciclo
  // escolar/Periodo semestral/Personal -- oculto del nav para docente
  // aunque el backend le permita GET (RBAC Nivel 1: docente solo R),
  // reusa el patrón "no lo tienta desde la navegación, sí llega por URL".
  if (esDirectivoOAdmin) {
    items.push(
      { icon: 'groups', label: 'Grupos', active: activeHref === '/grupo', href: '/grupo' },
      { icon: 'menu_book', label: 'Asignaturas', active: activeHref === '/asignatura', href: '/asignatura' },
      {
        icon: 'account_tree',
        label: 'Asignaciones',
        active: activeHref === '/grupo-asignatura',
        href: '/grupo-asignatura',
      },
    )
  }
  items.push({
    icon: 'grading',
    label: 'Calificaciones',
    active: activeHref === '/calificacion',
    href: '/calificacion',
  })
  // Asistencia (ADR-008, post-MVP): mismo criterio que Alumnos/Plantel --
  // docente tiene captura+lectura, directivo/admin solo lectura (nunca
  // corrigen, confirmado con el negocio) -- visible a los 3 roles, el
  // botón de captura se oculta dentro de la propia página, no en el nav.
  items.push({
    icon: 'event_available',
    label: 'Asistencia',
    active: activeHref === '/asistencia',
    href: '/asistencia',
  })
  return items
}
