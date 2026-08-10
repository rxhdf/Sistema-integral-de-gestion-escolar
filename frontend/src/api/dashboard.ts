import { apiGet } from '@/api/client'

// Contrato real: app/domains/dashboard/schemas.py. El backend elige la
// forma de la respuesta según el rol del JWT (mismo endpoint, sin param) --
// el frontend discrimina por presencia de campo, ver dashboard/DashboardPage.
export interface DashboardDirectivoOut {
  matricula_total: number
  grupos_activos: number
  personal_activo: number
  asignaturas_configuradas: number
}

export interface DashboardDocenteOut {
  numero_grupos_asignados: number
  numero_alumnos_bajo_responsabilidad: number
  calificaciones_pendientes: number
}

export type DashboardResumenOut = DashboardDirectivoOut | DashboardDocenteOut

export function isDashboardDocenteOut(data: DashboardResumenOut): data is DashboardDocenteOut {
  return 'numero_grupos_asignados' in data
}

export function getDashboardResumen(): Promise<DashboardResumenOut> {
  return apiGet<DashboardResumenOut>('/dashboard/resumen')
}
