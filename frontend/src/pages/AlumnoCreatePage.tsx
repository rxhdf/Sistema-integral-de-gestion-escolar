import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGrupos, type GrupoOut } from '@/api/academico'
import { postAlumno } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

// docs/frontend/02-especificacion-contenido.md, ficha 17 (POST /alumno):
// X, A dan de alta. id_plantel se toma de personal.data (nunca se pide en
// el formulario, mismo patrón que GrupoCreatePage/PersonalCreatePage).
// id_grupo es opcional -- se puede dar de alta sin inscribir todavía; la
// inscripción posterior vive en AlumnoListPage (ficha 18).
export function AlumnoCreatePage() {
  const navigate = useNavigate()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const grupos = useApiQuery<GrupoOut[]>(getGrupos)

  const [idGrupo, setIdGrupo] = useState('')
  const [matricula, setMatricula] = useState('')
  const [curp, setCurp] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [sexo, setSexo] = useState('')
  const [email, setEmail] = useState('')
  const [telefonoPersonal, setTelefonoPersonal] = useState('')
  const [fechaInscripcion, setFechaInscripcion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (personal.unauthorized || grupos.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
    }
  }, [personal.unauthorized, grupos.unauthorized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function resetForm() {
    setIdGrupo('')
    setMatricula('')
    setCurp('')
    setNombre('')
    setApellidoPaterno('')
    setApellidoMaterno('')
    setFechaNacimiento('')
    setSexo('')
    setEmail('')
    setTelefonoPersonal('')
    setFechaInscripcion('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!personal.data) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const alumno = await postAlumno({
        id_plantel: personal.data.id_plantel,
        id_grupo: idGrupo ? Number(idGrupo) : null,
        matricula,
        curp,
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno || null,
        fecha_nacimiento: fechaNacimiento,
        sexo: sexo || null,
        email: email || null,
        telefono_personal: telefonoPersonal || null,
        fecha_inscripcion: fechaInscripcion,
      })
      setSuccess(`Alumno "${alumno.nombre} ${alumno.apellido_paterno}" creado correctamente.`)
      resetForm()
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para dar de alta alumnos.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo crear el alumno.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Registra un nuevo alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Alta de alumno</h2>

          <div aria-live="polite">
            {error && (
              <div className="mb-4 rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-md border border-tertiary bg-tertiary-container px-sm py-sm font-label-md text-label-md text-on-tertiary-container">
                {success}
              </div>
            )}
          </div>

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="matricula">
                Matrícula
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="matricula"
                maxLength={20}
                required
                type="text"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="curp">
                CURP
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="curp"
                minLength={18}
                maxLength={18}
                required
                type="text"
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="nombre">
                Nombre
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="nombre"
                maxLength={80}
                required
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="apellido_paterno">
                Apellido paterno
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="apellido_paterno"
                maxLength={60}
                required
                type="text"
                value={apellidoPaterno}
                onChange={(e) => setApellidoPaterno(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="apellido_materno">
                Apellido materno
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="apellido_materno"
                maxLength={60}
                type="text"
                value={apellidoMaterno}
                onChange={(e) => setApellidoMaterno(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_nacimiento">
                Fecha de nacimiento
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="fecha_nacimiento"
                required
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="sexo">
                Sexo
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="sexo"
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Sin especificar</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="email">
                Email
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="email"
                maxLength={100}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="telefono_personal">
                Teléfono
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="telefono_personal"
                maxLength={20}
                type="tel"
                value={telefonoPersonal}
                onChange={(e) => setTelefonoPersonal(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_inscripcion">
                Fecha de inscripción
              </label>
              <input
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                id="fecha_inscripcion"
                required
                type="date"
                value={fechaInscripcion}
                onChange={(e) => setFechaInscripcion(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_grupo">
                Grupo (opcional)
              </label>
              <select
                className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                id="id_grupo"
                value={idGrupo}
                onChange={(e) => setIdGrupo(e.target.value)}
                disabled={isSubmitting || grupos.loading}
              >
                <option value="">Sin inscribir todavía</option>
                {grupos.data?.map((g) => (
                  <option key={g.id_grupo} value={g.id_grupo}>
                    {g.nombre_grupo}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-sm">
              <button
                className="w-full flex justify-center items-center gap-xs py-sm px-md border border-transparent rounded-md shadow-sm font-label-md text-label-md text-on-primary bg-primary-container hover:bg-on-primary-fixed-variant focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </DashboardShell>
  )
}
