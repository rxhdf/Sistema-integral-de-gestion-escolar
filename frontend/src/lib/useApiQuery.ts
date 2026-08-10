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
