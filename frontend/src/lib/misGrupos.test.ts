import { describe, expect, it } from 'vitest'
import { buildMisGrupos } from './misGrupos'

const grupoAsignaturas = [{ id_grupo_asig: 1, id_grupo: 10, id_asignatura: 100, id_docente: 1, id_periodo: 1 }]
const grupos = [
  { id_grupo: 10, id_plantel: 1, id_periodo: 1, semestre: 1 as const, nombre_grupo: '1A-DEV', capacidad_maxima: null },
]
const asignaturas = [
  { id_asignatura: 100, clave_asignatura: 'MAT-1', nombre: 'Matemáticas', semestre: 1 as const, activa: true },
]

describe('buildMisGrupos', () => {
  it('marca pendiente si algún alumno activo del grupo no tiene calificacion_final', () => {
    const alumnos = [
      { id_alumno: 1, id_grupo: 10, matricula: 'A1', nombre: 'Uno', apellido_paterno: 'Alu', apellido_materno: null, estatus: 'activo' },
      { id_alumno: 2, id_grupo: 10, matricula: 'A2', nombre: 'Dos', apellido_paterno: 'Alu', apellido_materno: null, estatus: 'activo' },
    ]
    const calificaciones = [
      {
        id_calificacion: 1,
        id_alumno: 1,
        id_grupo_asig: 1,
        parcial_1: 8,
        parcial_2: null,
        parcial_3: null,
        calificacion_final: 8,
        tipo_evaluacion: 'ordinaria' as const,
        estatus: 'aprobado' as const,
        fecha_captura: '2026-08-01',
      },
    ]

    const [row] = buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, calificaciones)
    expect(row).toMatchObject({
      nombreGrupo: '1A-DEV',
      nombreAsignatura: 'Matemáticas',
      numAlumnos: 2,
      tienePendientes: true,
    })
  })

  it('no marca pendiente cuando todos los alumnos activos ya tienen calificacion_final', () => {
    const alumnos = [
      { id_alumno: 1, id_grupo: 10, matricula: 'A1', nombre: 'Uno', apellido_paterno: 'Alu', apellido_materno: null, estatus: 'activo' },
    ]
    const calificaciones = [
      {
        id_calificacion: 1,
        id_alumno: 1,
        id_grupo_asig: 1,
        parcial_1: 9,
        parcial_2: null,
        parcial_3: null,
        calificacion_final: 9,
        tipo_evaluacion: 'ordinaria' as const,
        estatus: 'aprobado' as const,
        fecha_captura: '2026-08-01',
      },
    ]

    const [row] = buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, calificaciones)
    expect(row.tienePendientes).toBe(false)
  })

  it('ignora alumnos dados de baja al contar numAlumnos', () => {
    const alumnos = [
      { id_alumno: 1, id_grupo: 10, matricula: 'A1', nombre: 'Uno', apellido_paterno: 'Alu', apellido_materno: null, estatus: 'activo' },
      { id_alumno: 2, id_grupo: 10, matricula: 'A2', nombre: 'Dos', apellido_paterno: 'Alu', apellido_materno: null, estatus: 'baja' },
    ]

    const [row] = buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, [])
    expect(row.numAlumnos).toBe(1)
  })
})
