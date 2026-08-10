import { describe, expect, it } from 'vitest'
import { buildMisGrupos } from './misGrupos'

const grupoAsignaturas = [{ id_grupo_asig: 1, id_grupo: 10, id_asignatura: 100, id_docente: 1, id_periodo: 1 }]
const grupos = [{ id_grupo: 10, nombre_grupo: '1A-DEV' }]
const asignaturas = [{ id_asignatura: 100, nombre: 'Matemáticas' }]

describe('buildMisGrupos', () => {
  it('marca pendiente si algún alumno activo del grupo no tiene calificacion_final', () => {
    const alumnos = [
      { id_alumno: 1, id_grupo: 10, estatus: 'activo' },
      { id_alumno: 2, id_grupo: 10, estatus: 'activo' },
    ]
    const calificaciones = [{ id_alumno: 1, id_grupo_asig: 1, calificacion_final: 8 }]

    const [row] = buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, calificaciones)
    expect(row).toMatchObject({
      nombreGrupo: '1A-DEV',
      nombreAsignatura: 'Matemáticas',
      numAlumnos: 2,
      tienePendientes: true,
    })
  })

  it('no marca pendiente cuando todos los alumnos activos ya tienen calificacion_final', () => {
    const alumnos = [{ id_alumno: 1, id_grupo: 10, estatus: 'activo' }]
    const calificaciones = [{ id_alumno: 1, id_grupo_asig: 1, calificacion_final: 9 }]

    const [row] = buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, calificaciones)
    expect(row.tienePendientes).toBe(false)
  })

  it('ignora alumnos dados de baja al contar numAlumnos', () => {
    const alumnos = [
      { id_alumno: 1, id_grupo: 10, estatus: 'activo' },
      { id_alumno: 2, id_grupo: 10, estatus: 'baja' },
    ]

    const [row] = buildMisGrupos(grupoAsignaturas, grupos, asignaturas, alumnos, [])
    expect(row.numAlumnos).toBe(1)
  })
})
