import { apiGet, apiPost, apiPut } from '@/api/client'

// Contrato real: app/domains/organizacional/schemas.py (CicloEscolarCreate/Out).
export interface CicloEscolarCreate {
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}

export interface CicloEscolarOut extends CicloEscolarCreate {
  id_ciclo: number
}

export function postCicloEscolar(data: CicloEscolarCreate): Promise<CicloEscolarOut> {
  return apiPost<CicloEscolarOut>('/ciclo-escolar', data)
}

export function getCiclosEscolares(): Promise<CicloEscolarOut[]> {
  return apiGet<CicloEscolarOut[]>('/ciclo-escolar')
}

// Contrato real: app/domains/organizacional/schemas.py (PeriodoSemestralCreate/Out/Update).
export interface PeriodoSemestralCreate {
  id_ciclo: number
  clave_periodo: string
  numero_periodo: 1 | 2
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
}

export interface PeriodoSemestralOut extends PeriodoSemestralCreate {
  id_periodo: number
}

export function getPeriodosSemestrales(): Promise<PeriodoSemestralOut[]> {
  return apiGet<PeriodoSemestralOut[]>('/periodo-semestral')
}

export function postPeriodoSemestral(data: PeriodoSemestralCreate): Promise<PeriodoSemestralOut> {
  return apiPost<PeriodoSemestralOut>('/periodo-semestral', data)
}

// PeriodoSemestralUpdate solo tiene `activo` -- ver docstring en schemas.py,
// activar uno desactiva cualquier otro activo en la misma transacción
// (app/domains/organizacional/repository.py::set_periodo_semestral_activo),
// no hay 409 posible desde este endpoint.
export function putPeriodoSemestralActivo(idPeriodo: number, activo: boolean): Promise<PeriodoSemestralOut> {
  return apiPut<PeriodoSemestralOut>(`/periodo-semestral/${idPeriodo}`, { activo })
}

// Contrato real: app/domains/organizacional/schemas.py (PlantelOut/Update).
// Fichas 30-31 -- sin POST a propósito: el MVP es de un solo plantel, la
// fila se crea por seed/migración, nunca vía API.
export interface PlantelOut {
  id_plantel: number
  clave_plantel: string
  nombre_plantel: string
  municipio: string
  estado: string
  domicilio: string | null
  telefono: string | null
  email: string | null
  estatus: string
}

export interface PlantelUpdate {
  clave_plantel?: string
  nombre_plantel?: string
  municipio?: string
  estado?: string
  domicilio?: string | null
  telefono?: string | null
  email?: string | null
  estatus?: string
}

// GET /plantel devuelve list[PlantelOut] -- técnicamente una lista de 1
// elemento, la única fila del MVP (mismo razonamiento que el PUT sin {id}).
export function getPlantel(): Promise<PlantelOut[]> {
  return apiGet<PlantelOut[]>('/plantel')
}

// Rol(es): X, A -- ficha 31. Sin {id_plantel} en el path -- única fila.
export function putPlantel(data: PlantelUpdate): Promise<PlantelOut> {
  return apiPut<PlantelOut>('/plantel', data)
}
