import { apiGet } from '@/api/client'

// Contrato real: app/domains/log_acceso/schemas.py. Gestión de Cuentas
// Pieza 3 (ADR-011) -- nunca incluye la contraseña intentada, ni en
// texto plano ni hasheada.
export interface LogAccesoOut {
  id_log: number
  email_intentado: string
  id_personal: number | null
  exitoso: boolean
  motivo_fallo: string | null
  fecha_intento: string
}

// Rol(es): A únicamente (require_roles("admin")) -- log_acceso_select
// (RLS) refuerza lo mismo a nivel de fila. id_personal acota al
// historial de una persona (uso: sección "Historial de accesos" en
// PersonalEditPage.tsx); limit por defecto alcanza para esa vista sin
// paginación explícita en el cliente.
export function getLogAcceso(idPersonal: number, limit = 20): Promise<LogAccesoOut[]> {
  return apiGet<LogAccesoOut[]>(`/log-acceso?id_personal=${idPersonal}&limit=${limit}`)
}
