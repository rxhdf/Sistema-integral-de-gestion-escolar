import { apiGet, apiPost } from '@/api/client'

// Contrato real: app/domains/asistencia/schemas.py. Primera feature
// post-MVP (ADR-008) -- ver docs/data_dictionary/asistencia.md.
export type EstadoAsistencia = 'presente' | 'ausente' | 'retardo'

export interface AsistenciaOut {
  id_asistencia: number
  id_alumno: number
  id_grupo_asig: number
  fecha_sesion: string
  estado: EstadoAsistencia
  id_personal_registro: number
  fecha_captura: string
}

export interface AsistenciaRegistroLote {
  id_alumno: number
  estado: EstadoAsistencia
}

export interface AsistenciaLoteCreate {
  id_grupo_asig: number
  fecha_sesion: string
  registros: AsistenciaRegistroLote[]
}

export interface AsistenciaResumenOut {
  id_alumno: number
  presente: number
  ausente: number
  retardo: number
  total: number
}

// Rol(es): D únicamente (require_roles("docente")) -- directivo/admin NO
// capturan ni corrigen (confirmado con el negocio, ver ADR-008). UPSERT:
// recapturar el mismo id_grupo_asig+fecha_sesion corrige sin 409 -- es
// el mecanismo de corrección del propio docente, no un caso de error.
export function postAsistenciaLote(data: AsistenciaLoteCreate): Promise<AsistenciaOut[]> {
  return apiPost<AsistenciaOut[]>('/asistencia/lote', data)
}

// Rol(es): D (solo sus grupo_asignatura), X, A (todo el plantel) -- vista
// diaria de captura. Scope real lo aplica asistencia_select (RLS); estos
// dos parámetros son el filtro explícito de "qué día, qué grupo".
export function getAsistencia(idGrupoAsig: number, fechaSesion: string): Promise<AsistenciaOut[]> {
  const params = new URLSearchParams({ id_grupo_asig: String(idGrupoAsig), fecha: fechaSesion })
  return apiGet<AsistenciaOut[]>(`/asistencia?${params.toString()}`)
}

// Agregado calculado al vuelo (no persistido) -- mismo scope de fila que
// asistencia_select: el resumen de un docente solo cuenta las sesiones
// de SUS grupo_asignatura, no el historial completo del alumno.
export function getAsistenciaResumen(idAlumno: number): Promise<AsistenciaResumenOut> {
  return apiGet<AsistenciaResumenOut>(`/asistencia/resumen/${idAlumno}`)
}
