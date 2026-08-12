import { apiGet, apiPost, apiPut } from '@/api/client'

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

// --- Flujo 4: listado/alta/inscripción de Alumno + Expediente_Academico ---

// Contrato real: AlumnoOutDocente ∪ los 3 campos que solo ve directivo/admin
// (fecha_nacimiento, email, telefono_personal). Un solo tipo, campos extra
// opcionales -- el backend ya filtra el payload por rol
// (router.py::get_alumno, response_model=None); el frontend renderiza según
// las claves que realmente llegan, no reconstruye el filtrado (ficha 16,
// docs/frontend/02-especificacion-contenido.md).
export interface AlumnoRow {
  id_alumno: number
  id_plantel: number
  id_grupo: number | null
  matricula: string
  curp: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  sexo: string | null
  estatus: string
  fecha_inscripcion: string
  fecha_baja: string | null
  fecha_nacimiento?: string
  email?: string | null
  telefono_personal?: string | null
  municipio_origen?: string | null
  localidad_origen?: string | null
}

// search: docs/data_dictionary/perfil-analisis-alumno.md Pieza 2 --
// coincidencia parcial de nombre completo o CURP exacta, solo acota el
// mismo conjunto ya permitido por RLS, no cambia el scope.
export function getAlumnosFull(search?: string): Promise<AlumnoRow[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiGet<AlumnoRow[]>(`/alumno${query}`)
}

export interface AlumnoCreate {
  id_plantel: number
  id_grupo?: number | null
  matricula: string
  curp: string
  nombre: string
  apellido_paterno: string
  apellido_materno?: string | null
  fecha_nacimiento: string
  sexo?: string | null
  email?: string | null
  telefono_personal?: string | null
  fecha_inscripcion: string
  municipio_origen?: string | null
  localidad_origen?: string | null
}

// Rol(es): X, A -- ficha 17. matricula/curp UNIQUE se traducen a 409 (antes
// 500 crudo, corregido en esta entrega -- mismo patrón que Flujo 3).
export function postAlumno(data: AlumnoCreate): Promise<AlumnoRow> {
  return apiPost<AlumnoRow>('/alumno', data)
}

// Rol(es): X, A -- ficha 18. Alumno.id_grupo es nullable hasta este punto.
export function postAlumnoInscribir(idAlumno: number, idGrupo: number): Promise<AlumnoRow> {
  return apiPost<AlumnoRow>(`/alumno/${idAlumno}/inscribir`, { id_grupo: idGrupo })
}

// Contrato real: app/domains/alumnos/schemas.py::ExpedienteAcademicoOut. Sin
// split por rol -- matriz RBAC Nivel 3 confirma que docente ve los mismos
// campos que directivo/admin en esta entidad (ficha 20).
export interface ExpedienteAcademicoOut {
  id_exp_academico: number
  id_alumno: number
  escuela_procedencia: string | null
  promedio_secundaria: number | null
  promedio_actual: number | null
  situacion_academica: 'regular' | 'irregular' | 'condicionado'
}

export interface ExpedienteAcademicoCreate {
  id_alumno: number
  escuela_procedencia?: string | null
  promedio_secundaria?: number | null
  promedio_actual?: number | null
  situacion_academica: 'regular' | 'irregular' | 'condicionado'
}

// Rol(es): D (solo si el alumno está en su scope RLS), X, A -- ficha 20.
// 404 cubre tanto "no existe" como "fuera de scope" (mismo patrón de
// opacidad que /alumno, no distingue para no filtrar existencia).
export function getExpedienteAcademico(idAlumno: number): Promise<ExpedienteAcademicoOut> {
  return apiGet<ExpedienteAcademicoOut>(`/expediente-academico/${idAlumno}`)
}

// Rol(es): X, A -- ficha 19. id_alumno UNIQUE (relación 1:1) se traduce a
// 409 (antes 500 crudo, corregido en esta entrega).
export function postExpedienteAcademico(data: ExpedienteAcademicoCreate): Promise<ExpedienteAcademicoOut> {
  return apiPost<ExpedienteAcademicoOut>('/expediente-academico', data)
}

// Contrato real: app/domains/alumnos/schemas.py::AlumnoUpdate. Sin curp
// (no editable aquí).
export interface AlumnoUpdate {
  id_grupo?: number | null
  matricula?: string
  nombre?: string
  apellido_paterno?: string
  apellido_materno?: string | null
  fecha_nacimiento?: string
  sexo?: string | null
  email?: string | null
  telefono_personal?: string | null
  estatus?: string
  fecha_baja?: string | null
  municipio_origen?: string | null
  localidad_origen?: string | null
}

// Rol(es): X, A -- ficha 28. matricula UNIQUE -> 409 (corregido en esta
// entrega, igual que el POST).
export function putAlumno(idAlumno: number, data: AlumnoUpdate): Promise<AlumnoRow> {
  return apiPut<AlumnoRow>(`/alumno/${idAlumno}`, data)
}

export interface ExpedienteAcademicoUpdate {
  escuela_procedencia?: string | null
  promedio_secundaria?: number | null
  promedio_actual?: number | null
  situacion_academica?: 'regular' | 'irregular' | 'condicionado'
}

// Rol(es): X, A -- ficha 29. Sin riesgo de 409 (sin UNIQUE en los campos
// editables). promedio_actual normalmente lo recalcula el backend al
// capturar/corregir una calificación (fn_actualizar_promedio_actual) --
// editarlo aquí lo sobrescribe hasta la siguiente captura.
export function putExpedienteAcademico(
  idAlumno: number,
  data: ExpedienteAcademicoUpdate,
): Promise<ExpedienteAcademicoOut> {
  return apiPut<ExpedienteAcademicoOut>(`/expediente-academico/${idAlumno}`, data)
}
