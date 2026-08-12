import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getGrupos, type GrupoOut } from '@/api/academico'
import { getAlumnosFull, putAlumno, type AlumnoRow } from '@/api/alumnos'
import { ApiError, ForbiddenError, UnauthorizedError } from '@/api/client'
import { getPersonalMe, type PersonalMe } from '@/api/personal'
import { clearToken } from '@/auth/token'
import { DashboardShell } from '@/components/DashboardShell'
import { buildNavItems } from '@/lib/navItems'
import { useApiQuery } from '@/lib/useApiQuery'

interface FormData {
  alumnos: AlumnoRow[]
  grupos: GrupoOut[]
}

async function fetchFormData(): Promise<FormData> {
  const [alumnos, grupos] = await Promise.all([getAlumnosFull(), getGrupos()])
  return { alumnos, grupos }
}

// docs/frontend/02-especificacion-contenido.md, ficha 28 (PUT /alumno/{id}):
// X, A. curp no es editable aquí. matricula UNIQUE -> 409 (corregido en
// esta entrega, igual que el POST). El campo estatus también vive aquí
// (dar de baja) además de en la ficha 18 (inscribir) -- se anuncia con
// aria-live="assertive" porque afecta si el alumno sigue apareciendo en
// listados operativos de docentes.
export function AlumnoEditPage() {
  const navigate = useNavigate()
  const { idAlumno } = useParams<{ idAlumno: string }>()
  const personal = useApiQuery<PersonalMe>(getPersonalMe)
  const formData = useApiQuery<FormData>(fetchFormData)

  const [idGrupo, setIdGrupo] = useState('')
  const [matricula, setMatricula] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [sexo, setSexo] = useState('')
  const [email, setEmail] = useState('')
  const [telefonoPersonal, setTelefonoPersonal] = useState('')
  const [estatus, setEstatus] = useState('activo')
  const [fechaBaja, setFechaBaja] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const alumno = formData.data?.alumnos.find((a) => a.id_alumno === Number(idAlumno))

  useEffect(() => {
    if (personal.unauthorized || formData.unauthorized) {
      clearToken()
      navigate('/login', { replace: true })
      return
    }
    if (formData.data && !initialized) {
      if (!alumno) {
        setNotFound(true)
      } else {
        setIdGrupo(alumno.id_grupo !== null ? String(alumno.id_grupo) : '')
        setMatricula(alumno.matricula)
        setNombre(alumno.nombre)
        setApellidoPaterno(alumno.apellido_paterno)
        setApellidoMaterno(alumno.apellido_materno ?? '')
        setFechaNacimiento(alumno.fecha_nacimiento ?? '')
        setSexo(alumno.sexo ?? '')
        setEmail(alumno.email ?? '')
        setTelefonoPersonal(alumno.telefono_personal ?? '')
        setEstatus(alumno.estatus)
        setFechaBaja(alumno.fecha_baja ?? '')
      }
      setInitialized(true)
    }
  }, [personal.unauthorized, formData.unauthorized, formData.data, alumno, initialized, navigate])

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idAlumno) return
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      const actualizado = await putAlumno(Number(idAlumno), {
        id_grupo: idGrupo ? Number(idGrupo) : null,
        matricula,
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno || null,
        fecha_nacimiento: fechaNacimiento,
        sexo: sexo || null,
        email: email || null,
        telefono_personal: telefonoPersonal || null,
        estatus,
        fecha_baja: fechaBaja || null,
      })
      setSuccess(`Alumno "${actualizado.nombre} ${actualizado.apellido_paterno}" actualizado correctamente.`)
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        clearToken()
        navigate('/login', { replace: true })
        return
      }
      if (err instanceof ForbiddenError) {
        setError('No tienes permiso para editar alumnos.')
      } else if (err instanceof ApiError && err.message.includes('no encontrado')) {
        setNotFound(true)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('No se pudo actualizar el alumno.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardShell
      personal={personal.data}
      navItems={buildNavItems(personal.data?.rol, '/alumno')}
      greetingSubtitle="Edita los datos de un alumno."
      onLogout={handleLogout}
    >
      <section className="max-w-xl">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
          <h2 className="text-headline-md font-headline-md font-bold text-on-surface mb-4">Edición de alumno</h2>

          {formData.loading ? (
            <div aria-hidden="true" className="h-40 bg-surface-container animate-pulse rounded-lg" />
          ) : formData.error ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              {formData.error}
            </div>
          ) : notFound ? (
            <div role="alert" className="rounded-md border border-error bg-error-container px-sm py-sm font-label-md text-label-md text-on-error-container">
              Alumno no encontrado.
            </div>
          ) : (
            <>
              <div aria-live="assertive">
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
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="id_grupo">
                    Grupo
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md min-h-[44px]"
                    id="id_grupo"
                    value={idGrupo}
                    onChange={(e) => setIdGrupo(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">Sin grupo</option>
                    {formData.data?.grupos.map((g) => (
                      <option key={g.id_grupo} value={g.id_grupo}>
                        {g.nombre_grupo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface block" htmlFor="estatus">
                    Estatus
                  </label>
                  <select
                    className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                    id="estatus"
                    value={estatus}
                    onChange={(e) => setEstatus(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="activo">Activo</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>

                {estatus === 'baja' && (
                  <div className="space-y-xs">
                    <label className="font-label-md text-label-md text-on-surface block" htmlFor="fecha_baja">
                      Fecha de baja
                    </label>
                    <input
                      className="block w-full px-sm py-sm border border-outline-variant rounded-md bg-surface focus:ring-0 focus:border-primary transition-colors text-on-surface font-body-md"
                      id="fecha_baja"
                      type="date"
                      value={fechaBaja}
                      onChange={(e) => setFechaBaja(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

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
            </>
          )}
        </div>
      </section>
    </DashboardShell>
  )
}
