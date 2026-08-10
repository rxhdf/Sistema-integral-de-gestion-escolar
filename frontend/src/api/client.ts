import { clearToken, getToken } from '@/auth/token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {}
export class UnauthorizedError extends ApiError {}
export class ForbiddenError extends ApiError {}

// FastAPI serializa errores como { detail: string } (HTTPException, incluida
// la traducción de constraints en el service — ver 422/409 de
// POST /ciclo-escolar y POST /periodo-semestral) o { detail: [{msg, ...}] }
// (422 de validación de Pydantic, antes de llegar al service).
async function throwForErrorResponse(response: Response): Promise<never> {
  if (response.status === 401) {
    clearToken()
    throw new UnauthorizedError('Sesión expirada. Vuelve a iniciar sesión.')
  }
  const body = await response.json().catch(() => null)
  const detail = body?.detail
  const message = Array.isArray(detail)
    ? detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join(' ')
    : detail
  const ErrorClass = response.status === 403 ? ForbiddenError : ApiError
  throw new ErrorClass(message || 'No se pudo completar la solicitud.')
}

// GET autenticado compartido por todo endpoint protegido (ver api/auth.ts
// para el único endpoint sin token: /auth/login).
export async function apiGet<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica tu conexión.')
  }
  if (!response.ok) return throwForErrorResponse(response)
  return response.json() as Promise<T>
}

// POST autenticado compartido por todo endpoint protegido de escritura.
export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica tu conexión.')
  }
  if (!response.ok) return throwForErrorResponse(response)
  return response.json() as Promise<T>
}

// PUT autenticado compartido por todo endpoint protegido de edición.
export async function apiPut<T>(path: string, payload: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken() ?? ''}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica tu conexión.')
  }
  if (!response.ok) return throwForErrorResponse(response)
  return response.json() as Promise<T>
}
