import { apiGet } from '@/api/client'

// Contratos reales: app/domains/academico/schemas.py.
export interface GrupoOut {
  id_grupo: number
  nombre_grupo: string
}

export interface AsignaturaOut {
  id_asignatura: number
  nombre: string
}

export interface GrupoAsignaturaOut {
  id_grupo_asig: number
  id_grupo: number
  id_asignatura: number
  id_docente: number
  id_periodo: number
}

export function getGrupos(): Promise<GrupoOut[]> {
  return apiGet<GrupoOut[]>('/grupo')
}

export function getAsignaturas(): Promise<AsignaturaOut[]> {
  return apiGet<AsignaturaOut[]>('/asignatura')
}

export function getGrupoAsignaturas(): Promise<GrupoAsignaturaOut[]> {
  return apiGet<GrupoAsignaturaOut[]>('/grupo-asignatura')
}
