import type { AlumnoOut } from '@/api/alumnos'
import type { AsignaturaOut, GrupoAsignaturaOut, GrupoOut } from '@/api/academico'
import type { CalificacionOut } from '@/api/calificaciones'

export interface MisGrupoRow {
  id_grupo_asig: number
  nombreGrupo: string
  nombreAsignatura: string
  numAlumnos: number
  tienePendientes: boolean
}

// Join en cliente: /dashboard/resumen solo da agregados (numero_grupos_asignados,
// etc.), no el detalle por grupo que pide la tabla "Mis grupos" -- se arma
// aquí a partir de las mismas 4 listas que ya expone la API (grupo-asignatura,
// grupo, asignatura, alumno, calificacion), todas ya acotadas al docente por RLS.
export function buildMisGrupos(
  grupoAsignaturas: GrupoAsignaturaOut[],
  grupos: GrupoOut[],
  asignaturas: AsignaturaOut[],
  alumnos: AlumnoOut[],
  calificaciones: CalificacionOut[],
): MisGrupoRow[] {
  const alumnosActivosPorGrupo = new Map<number, AlumnoOut[]>()
  for (const alumno of alumnos) {
    if (alumno.estatus !== 'activo' || alumno.id_grupo === null) continue
    const lista = alumnosActivosPorGrupo.get(alumno.id_grupo) ?? []
    lista.push(alumno)
    alumnosActivosPorGrupo.set(alumno.id_grupo, lista)
  }

  const completosPorGrupoAsig = new Map<number, Set<number>>()
  for (const calificacion of calificaciones) {
    if (calificacion.calificacion_final === null) continue
    const set = completosPorGrupoAsig.get(calificacion.id_grupo_asig) ?? new Set<number>()
    set.add(calificacion.id_alumno)
    completosPorGrupoAsig.set(calificacion.id_grupo_asig, set)
  }

  return grupoAsignaturas.map((ga) => {
    const alumnosDelGrupo = alumnosActivosPorGrupo.get(ga.id_grupo) ?? []
    const completos = completosPorGrupoAsig.get(ga.id_grupo_asig) ?? new Set<number>()
    return {
      id_grupo_asig: ga.id_grupo_asig,
      nombreGrupo: grupos.find((g) => g.id_grupo === ga.id_grupo)?.nombre_grupo ?? `Grupo #${ga.id_grupo}`,
      nombreAsignatura:
        asignaturas.find((a) => a.id_asignatura === ga.id_asignatura)?.nombre ?? `Materia #${ga.id_asignatura}`,
      numAlumnos: alumnosDelGrupo.length,
      tienePendientes: alumnosDelGrupo.some((alumno) => !completos.has(alumno.id_alumno)),
    }
  })
}
