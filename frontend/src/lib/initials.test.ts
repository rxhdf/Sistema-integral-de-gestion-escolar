import { describe, expect, it } from 'vitest'
import { getInitials } from './initials'

describe('getInitials', () => {
  it('toma la primera letra de nombre y apellido paterno, en mayúsculas', () => {
    expect(getInitials('Ana', 'García')).toBe('AG')
  })

  it('funciona con nombres compuestos (usa solo la primera palabra)', () => {
    expect(getInitials('José Luis', 'Pérez')).toBe('JP')
  })
})
