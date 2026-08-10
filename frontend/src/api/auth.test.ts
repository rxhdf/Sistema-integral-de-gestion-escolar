import { afterEach, describe, expect, it, vi } from 'vitest'
import { login, LoginError } from './auth'

describe('login', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devuelve el token en credenciales válidas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'jwt.token', token_type: 'bearer' }),
      }),
    )

    const result = await login('docente@cobao.edu.mx', 'correcta')
    expect(result.access_token).toBe('jwt.token')
  })

  it('mapea el 401 real del backend (detail: "Credenciales inválidas")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Credenciales inválidas' }),
      }),
    )

    await expect(login('docente@cobao.edu.mx', 'mala')).rejects.toThrow(
      new LoginError('Credenciales inválidas'),
    )
  })

  it('mapea fallas de red a un mensaje de conexión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    await expect(login('docente@cobao.edu.mx', 'x')).rejects.toThrow(LoginError)
  })
})
