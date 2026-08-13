// Falla explícito si falta VITE_API_BASE_URL en vez de caer a un hostname
// de túnel hardcodeado (mismo patrón que JWT_SECRET_KEY en
// app/core/config.py): un default silencioso a una URL vieja/muerta es peor
// que un build que no arranca.
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!rawBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL no está definida — copia frontend/.env.example a frontend/.env y ajusta el valor.',
  )
}

export const API_BASE_URL = rawBaseUrl
