import { apiGet } from '@/api/client'

// Contrato real: app/domains/alumnos/schemas.py::AlumnoOutDocente (subconjunto
// que ambos roles reciben -- nombre/apellido/matricula se usan para mostrar
// el selector de alumno en captura/corrección de calificación; los campos
// extra que solo ve directivo/admin (fecha_nacimiento, email, etc.) no se
// necesitan aquí y se quedan fuera a propósito).
export interface AlumnoOut {
  id_alumno: number
  id_grupo: number | null
  matricula: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  estatus: string
}

export function getAlumnos(): Promise<AlumnoOut[]> {
  return apiGet<AlumnoOut[]>('/alumno')
}
