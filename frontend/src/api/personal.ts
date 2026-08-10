import { apiGet, apiPost } from '@/api/client'

// Contrato real: app/domains/personal/schemas.py::PersonalOutSelf (== PersonalOut,
// incluye id_plantel -- lo reusamos para no pedir GET /plantel aparte al armar
// el alta de personal, MVP de un solo plantel).
export interface PersonalMe {
  id_personal: number
  id_plantel: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  email_institucional: string
  rol: 'docente' | 'directivo' | 'admin'
  estatus: string
}

export function getPersonalMe(): Promise<PersonalMe> {
  return apiGet<PersonalMe>('/personal/me')
}

// Contrato real: app/domains/personal/schemas.py (PersonalCreate/Out).
export interface PersonalCreate {
  id_plantel: number
  curp: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string | null
  email_institucional: string
  rol: 'docente' | 'directivo' | 'admin'
  telefono?: string | null
  fecha_ingreso?: string | null
  password: string
}

export interface PersonalOut {
  id_plantel: number
  curp: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  email_institucional: string
  rol: 'docente' | 'directivo' | 'admin'
  telefono: string | null
  fecha_ingreso: string | null
  id_personal: number
  estatus: string
}

// Rol(es): X, A (require_roles("directivo", "admin")) -- ficha 9.
export function getPersonal(): Promise<PersonalOut[]> {
  return apiGet<PersonalOut[]>('/personal')
}

// Rol(es): A únicamente (require_roles("admin")) -- ficha 8.
export function postPersonal(data: PersonalCreate): Promise<PersonalOut> {
  return apiPost<PersonalOut>('/personal', data)
}
