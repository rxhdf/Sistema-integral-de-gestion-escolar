import { API_BASE_URL } from './config'

// Contrato real: app/domains/personal/schemas.py (LoginRequest/TokenResponse)
export interface LoginResponse {
  access_token: string
  token_type: string
}

export class LoginError extends Error {}

export async function login(emailInstitucional: string, password: string): Promise<LoginResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_institucional: emailInstitucional, password }),
    })
  } catch {
    throw new LoginError('No se pudo conectar con el servidor. Verifica tu conexión.')
  }

  if (!response.ok) {
    // FastAPI HTTPException serializa el mensaje en { detail: string }.
    const body = await response.json().catch(() => null)
    throw new LoginError(body?.detail ?? 'No se pudo iniciar sesión.')
  }

  return response.json() as Promise<LoginResponse>
}
