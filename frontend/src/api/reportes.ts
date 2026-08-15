import { apiGet, apiPost } from '@/api/client'

// Contrato real: app/domains/reportes/schemas.py. ADR-010: cualquier
// docente activo reporta sobre cualquier alumno del plantel, sin
// requerir grupo_asignatura -- a diferencia de Calificacion/Asistencia.
export interface ReporteIncidenciaOut {
  id_reporte_incidencia: number
  id_alumno: number
  id_personal_reporta: number
  fecha_incidente: string
  descripcion: string
  fecha_registro: string
}

export interface ReporteIncidenciaCreate {
  id_alumno: number
  fecha_incidente: string
  descripcion: string
}

// Rol(es): D únicamente (require_roles("docente")), activo -- un docente
// dado de baja recibe 403 (RLS, no solo el claim del JWT). Sin PUT/DELETE
// a propósito: tabla inmutable.
export function postReporteIncidencia(data: ReporteIncidenciaCreate): Promise<ReporteIncidenciaOut> {
  return apiPost<ReporteIncidenciaOut>('/reporte-incidencia', data)
}

// Rol(es): D (solo lo que él mismo reportó), X, A (todo el plantel).
// id_alumno es un filtro explícito opcional -- scope real lo aplica RLS.
export function getReporteIncidencia(idAlumno?: number): Promise<ReporteIncidenciaOut[]> {
  const query = idAlumno != null ? `?id_alumno=${idAlumno}` : ''
  return apiGet<ReporteIncidenciaOut[]>(`/reporte-incidencia${query}`)
}
