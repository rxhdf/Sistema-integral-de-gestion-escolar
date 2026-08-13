import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El JWT se guarda en localStorage (frontend/src/auth/token.ts) -- sin
// httpOnly, cualquier XSS podría robarlo. Este CSP es la mitigación de
// defensa en profundidad: sin 'unsafe-inline'/'unsafe-eval' en script-src,
// un XSS no puede ejecutar el payload típico de exfiltración.
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; connect-src 'self' https:; object-src 'none'; " +
    "frame-ancestors 'none'; base-uri 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Sufijo wildcard en vez de `true`: el hostname del túnel de Cloudflare
    // cambia cada vez que se reinicia, pero `true` desactiva por completo la
    // validación del header Host (protección contra DNS rebinding) para
    // CUALQUIER hostname. El sufijo tolera la rotación del túnel sin abrir
    // esa puerta.
    allowedHosts: ['.trycloudflare.com', 'localhost'],
    // Solo X-Frame-Options/X-Content-Type-Options en dev -- el CSP completo
    // se deja para `preview` para no arriesgar romper el HMR de Vite (que
    // no se ha podido probar en vivo con script-src restringido).
    headers: {
      'X-Content-Type-Options': securityHeaders['X-Content-Type-Options'],
      'X-Frame-Options': securityHeaders['X-Frame-Options'],
    },
  },
  // El dev server (server.*) sirve módulos ES sin empaquetar -- cientos de
  // requests pequeños que el túnel gratuito de Cloudflare cancela seguido
  // ("stream canceled by remote", ver docs/validacion/ o el log de
  // cloudflared). `vite preview` sirve el build de producción (~4 archivos
  // grandes) detrás del mismo túnel sin ese problema -- mismo allowedHosts.
  preview: {
    allowedHosts: ['.trycloudflare.com', 'localhost'],
    headers: securityHeaders,
  },
})
