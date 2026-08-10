import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, LoginError } from '@/api/auth'
import { setToken } from '@/auth/token'
import cobaoLogo from '@/assets/images/cobao_logo.svg'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const { access_token } = await login(email, password)
      setToken(access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof LoginError ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-surface min-h-screen font-body-md text-on-surface antialiased flex flex-col md:flex-row">
      {/* Panel institucional */}
      <div className="hidden md:flex md:w-1/2 lg:w-7/12 bg-surface-container-low flex-col justify-between p-margin-desktop relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M0,100 C20,80 40,90 60,70 C80,50 100,60 100,60 L100,0 L0,0 Z" fill="#e30613" />
          </svg>
        </div>
        <div className="z-10 flex flex-col items-start max-w-2xl">
          <div className="flex items-center gap-sm mb-lg">
            <div className="bg-surface p-sm rounded-xl border border-surface-variant shadow-sm w-24 h-24 flex-shrink-0 flex items-center justify-center">
              <img alt="COBAO Logo" className="w-full h-full object-contain" src={cobaoLogo} />
            </div>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">SIGE</h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Sistema Integral de Gestión Educativa
              </p>  
              <p className="font-label-md text-label-md text-on-surface-variant mt-xs">
                Educación pública de calidad
              </p>
            </div>
          </div>
          <div className="h-px w-full bg-outline-variant/30 mb-lg" />
          <div className="space-y-md w-full">
            <div className="flex items-start gap-md p-md bg-surface border border-outline-variant/50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                <span className="material-symbols-outlined fill text-2xl">folder_shared</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface text-lg">
                  Centraliza expedientes académicos
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
                  Acceso inmediato a la trayectoria estudiantil completa en un entorno seguro y unificado.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-md p-md bg-surface border border-outline-variant/50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                <span className="material-symbols-outlined fill text-2xl">bar_chart</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface text-lg">
                  Digitaliza captura y consulta
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
                  Agiliza el registro de calificaciones y su visibilidad en tiempo real para la comunidad
                  académica.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-md p-md bg-surface border border-outline-variant/50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                <span className="material-symbols-outlined fill text-2xl">admin_panel_settings</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface text-lg">
                  Acceso basado en roles
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
                  Control de permisos estrictos para directivos, docentes y personal administrativo.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="z-10 mt-lg">
          <p className="font-body-lg text-body-lg italic text-on-surface-variant border-l-4 border-primary pl-md py-sm">
            "Educación que transforma, futuro que trasciende"
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="w-full md:w-1/2 lg:w-5/12 bg-surface flex flex-col justify-center items-center p-margin-mobile md:p-margin-desktop min-h-screen relative">
        <div className="md:hidden flex flex-col items-center mb-lg w-full">
          <img alt="COBAO Logo" className="w-20 h-20 object-contain mb-sm" src={cobaoLogo} />
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface text-center">SIGE</h1>
          <p className="font-label-md text-label-md text-on-surface-variant text-center">
            Sistema Integral de Gestión Educativa
          </p>
          <span className="inline-block mt-xs px-sm py-1 bg-surface-variant text-on-surface font-label-sm text-label-sm rounded-full">
            Plantel 01 Pueblo Nuevo
          </span>
          <p className="font-label-md text-label-md text-on-surface-variant text-center mt-xs">
            Educación pública de calidad
          </p>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-lg">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Iniciar Sesión</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
              Ingresa tus credenciales institucionales para acceder al portal.
            </p>
          </div>

          <form className="space-y-md" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container"
              >
                {error}
              </div>
            )}

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="email">
                Correo Institucional
              </label>
              <div className="relative input-glow rounded-md transition-shadow">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-on-surface-variant">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <input
                  className="block w-full pl-xl pr-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface placeholder:text-on-surface-variant/50 font-body-md"
                  id="email"
                  name="email"
                  placeholder="usuario@cobao.edu.mx"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="password">
                Contraseña
              </label>
              <div className="relative input-glow rounded-md transition-shadow">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-on-surface-variant">
                  <span className="material-symbols-outlined">lock</span>
                </div>
                <input
                  className="block w-full pl-xl pr-xl py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface placeholder:text-on-surface-variant/50 font-body-md"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  aria-label="Toggle password visibility"
                  className="absolute inset-y-0 right-0 pr-sm flex items-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowPassword((v) => !v)}
                  type="button"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-sm">
              <div className="flex items-center">
                <input
                  className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded bg-surface"
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                />
                <label className="ml-2 block font-label-md text-label-md text-on-surface-variant" htmlFor="remember-me">
                  Recordar usuario
                </label>
              </div>
              <a className="font-label-md text-label-md text-primary hover:text-primary-fixed-dim transition-colors" href="#">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <div className="pt-sm">
              <button
                className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Iniciando sesión…' : 'Iniciar Sesión'}
                {!isSubmitting && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
              </button>
            </div>
          </form>

          <div className="mt-xl pt-md border-t border-outline-variant/30 flex flex-col items-center">
            <p className="font-label-sm text-label-sm text-on-surface-variant text-center mb-xs">
              ¿Necesitas ayuda para ingresar?
            </p>
            <a
              className="flex items-center gap-xs font-label-md text-label-md text-on-surface hover:text-primary transition-colors"
              href="mailto:soporte.sige@cobao.edu.mx"
            >
              <span className="material-symbols-outlined text-sm">support_agent</span>
              soporte.sige@cobao.edu.mx
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
