import { apiGet, apiPost, apiPut } from '@/api/client'

type Semestre = 1 | 2 | 3 | 4 | 5 | 6

// Contratos reales: app/domains/academico/schemas.py.
export interface GrupoOut {
  id_grupo: number
  id_plantel: number
  id_periodo: number
  semestre: Semestre
  nombre_grupo: string
  capacidad_maxima: number | null
}

export interface GrupoCreate {
  id_plantel: number
  id_periodo: number
  semestre: Semestre
  nombre_grupo: string
  capacidad_maxima: number | null
}

export interface AsignaturaOut {
  id_asignatura: number
  clave_asignatura: string
  nombre: string
  semestre: Semestre
  activa: boolean
}

export interface AsignaturaCreate {
  clave_asignatura: string
  nombre: string
  semestre: Semestre
  activa: boolean
}

export interface GrupoAsignaturaOut {
  id_grupo_asig: number
  id_grupo: number
  id_asignatura: number
  id_docente: number
  id_periodo: number
}

export interface GrupoAsignaturaCreate {
  id_grupo: number
  id_asignatura: number
  id_docente: number
  id_periodo: number
}

export function getGrupos(): Promise<GrupoOut[]> {
  return apiGet<GrupoOut[]>('/grupo')
}

// Rol(es): X, A (require_roles("directivo", "admin")) -- ficha 11.
// uq_grupo_nombre_periodo (id_plantel+id_periodo+nombre_grupo) se traduce
// a 409 en el service (antes era 500 crudo, corregido en esta entrega).
export function postGrupo(data: GrupoCreate): Promise<GrupoOut> {
  return apiPost<GrupoOut>('/grupo', data)
}

export function getAsignaturas(): Promise<AsignaturaOut[]> {
  return apiGet<AsignaturaOut[]>('/asignatura')
}

// Rol(es): X, A -- ficha 13. clave_asignatura UNIQUE se traduce a 409
// (antes 500 crudo, corregido en esta entrega).
export function postAsignatura(data: AsignaturaCreate): Promise<AsignaturaOut> {
  return apiPost<AsignaturaOut>('/asignatura', data)
}

export function getGrupoAsignaturas(): Promise<GrupoAsignaturaOut[]> {
  return apiGet<GrupoAsignaturaOut[]>('/grupo-asignatura')
}

// Rol(es): X, A -- ficha 15. Dos formas de rechazo distintas del backend,
// ambas ya traducidas a 4xx claro:
// - id_docente no es rol='docente' -> 400 (trigger fn_valida_rol_docente,
//   app/domains/academico/service.py::DocenteInvalidoError, ya existía).
// - uq_grupo_asignatura_periodo duplicado -> 409 (corregido en esta entrega).
export function postGrupoAsignatura(data: GrupoAsignaturaCreate): Promise<GrupoAsignaturaOut> {
  return apiPost<GrupoAsignaturaOut>('/grupo-asignatura', data)
}

// Contrato real: app/domains/academico/schemas.py::GrupoUpdate/AsignaturaUpdate/
// GrupoAsignaturaUpdate. Ediciones parciales (fichas 25-27).
export interface GrupoUpdate {
  id_periodo?: number
  semestre?: Semestre
  nombre_grupo?: string
  capacidad_maxima?: number | null
}

// Rol(es): X, A -- ficha 25. uq_grupo_nombre_periodo -> 409 (corregido en
// esta entrega, igual que el POST).
export function putGrupo(idGrupo: number, data: GrupoUpdate): Promise<GrupoOut> {
  return apiPut<GrupoOut>(`/grupo/${idGrupo}`, data)
}

export interface AsignaturaUpdate {
  nombre?: string
  semestre?: Semestre
  activa?: boolean
}

// Rol(es): X, A -- ficha 26. Sin riesgo de 409: clave_asignatura (única
// UNIQUE de la entidad) no es editable aquí.
export function putAsignatura(idAsignatura: number, data: AsignaturaUpdate): Promise<AsignaturaOut> {
  return apiPut<AsignaturaOut>(`/asignatura/${idAsignatura}`, data)
}

export interface GrupoAsignaturaUpdate {
  id_docente?: number
  id_periodo?: number
}

// Rol(es): X, A -- ficha 27. Mismos dos rechazos que el POST (ficha 15):
// id_docente inválido -> 400, uq_grupo_asignatura_periodo -> 409 (corregido
// en esta entrega).
export function putGrupoAsignatura(
  idGrupoAsig: number,
  data: GrupoAsignaturaUpdate,
): Promise<GrupoAsignaturaOut> {
  return apiPut<GrupoAsignaturaOut>(`/grupo-asignatura/${idGrupoAsig}`, data)
}
