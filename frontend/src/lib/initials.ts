// Personal no tiene columna foto (docs/data_dictionary/mvp.md) — avatar de
// iniciales generado del nombre real, no foto.
export function getInitials(nombre: string, apellidoPaterno: string): string {
  const inicialNombre = nombre.trim().charAt(0)
  const inicialApellido = apellidoPaterno.trim().charAt(0)
  return `${inicialNombre}${inicialApellido}`.toUpperCase()
}
