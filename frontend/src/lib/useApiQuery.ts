import { useEffect, useState } from 'react'
import { UnauthorizedError } from '@/api/client'

export interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  unauthorized: boolean
}

// Mismo estado (loading/error/data) para cualquier GET autenticado -- se
// reusa en vez de duplicar el useEffect en cada página.
export function useApiQuery<T>(fetcher: () => Promise<T>): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
    unauthorized: false,
  })

  useEffect(() => {
    let cancelled = false
    // Vuelve a loading:true al cambiar de fetcher (ej. un useCallback que
    // depende de un id de ruta o de un select) -- sin esto, `state` se
    // queda con el data/loading:false de la consulta ANTERIOR mientras la
    // nueva sigue en vuelo, y cualquier página que decida "ya terminó de
    // cargar" mirando solo `loading` actúa sobre datos viejos (bug real,
    // encontrado en AsistenciaCapturaPage.tsx: el precargado de asistencia
    // se inicializaba con el resultado vacío de la consulta anterior antes
    // de que la consulta real del grupo recién elegido resolviera).
    setState((prev) => ({ ...prev, loading: true }))
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null, unauthorized: false })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const unauthorized = err instanceof UnauthorizedError
        setState({
          data: null,
          loading: false,
          unauthorized,
          error: unauthorized ? null : err instanceof Error ? err.message : 'Error inesperado.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [fetcher])

  return state
}
