import { apiGet, apiPost, apiPut } from '@/api/client'

// Contrato real: app/domains/control_escolar/schemas.py::CalificacionOut.
// calificacion_final/estatus son SIEMPRE de solo lectura -- el service los
// calcula (ADR-005), ni CalificacionCreate ni CalificacionUpdate los
// aceptan como entrada (ver abajo), así que no hay manera de que el
// frontend los mande aunque quisiera.
export interface CalificacionOut {
  id_calificacion: number
  id_alumno: number
  id_grupo_asig: number
  parcial_1: number | null
  parcial_2: number | null
  parcial_3: number | null
  calificacion_final: number | null
  tipo_evaluacion: 'ordinaria' | 'extraordinaria'
  estatus: 'aprobado' | 'reprobado' | 'pendiente'
  fecha_captura: string
}

export function getCalificaciones(): Promise<CalificacionOut[]> {
  return apiGet<CalificacionOut[]>('/calificacion')
}

// Contrato real: app/domains/control_escolar/schemas.py::CalificacionCreate.
// Rol: D únicamente (require_roles("docente")) -- ficha 22.
export interface CalificacionCreate {
  id_alumno: number
  id_grupo_asig: number
  parcial_1?: number | null
  parcial_2?: number | null
  parcial_3?: number | null
  tipo_evaluacion?: 'ordinaria' | 'extraordinaria'
}

export function postCalificacion(data: CalificacionCreate): Promise<CalificacionOut> {
  return apiPost<CalificacionOut>('/calificacion', data)
}

// Contrato real: app/domains/control_escolar/schemas.py::CalificacionUpdate.
// Rol: D (solo lo suyo, vía RLS), X, A (todo el plantel, ADR-004) -- ficha 23.
export interface CalificacionUpdate {
  parcial_1?: number | null
  parcial_2?: number | null
  parcial_3?: number | null
  tipo_evaluacion?: 'ordinaria' | 'extraordinaria'
}

export function putCalificacion(idCalificacion: number, data: CalificacionUpdate): Promise<CalificacionOut> {
  return apiPut<CalificacionOut>(`/calificacion/${idCalificacion}`, data)
}
