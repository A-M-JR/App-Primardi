import { useState, useEffect, useCallback, useRef } from "react"

// Cache global em memória + espelho em sessionStorage (sobrevive ao F5 e à
// navegação dentro da sessão da aba). É um cache por-navegador, sem risco
// multitenant: `clearDataCache()` (chamado em login/logout/troca de empresa)
// zera memória E sessionStorage.
const globalCache: Record<string, { data: any; timestamp: number }> = {}
const STORAGE_PREFIX = "dq:"

// Hidrata o cache em memória a partir do sessionStorage UMA vez, no client,
// antes de qualquer render — assim páginas revisitadas (e o F5) pintam na hora.
if (typeof window !== "undefined") {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) {
        const raw = sessionStorage.getItem(k)
        if (raw) globalCache[k.slice(STORAGE_PREFIX.length)] = JSON.parse(raw)
      }
    }
  } catch {
    /* sessionStorage indisponível/corrompido — segue só com cache em memória */
  }
}

function persist(cacheKey: string, entry: { data: any; timestamp: number }) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_PREFIX + cacheKey, JSON.stringify(entry))
  } catch {
    /* cota estourada / serialização — ignora; o cache em memória continua valendo */
  }
}

export function clearDataCache() {
  Object.keys(globalCache).forEach(key => delete globalCache[key])
  if (typeof window !== "undefined") {
    try {
      const remover: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith(STORAGE_PREFIX)) remover.push(k)
      }
      remover.forEach(k => sessionStorage.removeItem(k))
    } catch {
      /* ignora */
    }
  }
  console.log("Cache de dados zerado para nova sessão.")
}

interface UseDataQueryOptions<T> {
  key: string | any[] | object
  fetcher: () => Promise<T>
  refetchInterval?: number
  enabled?: boolean
}

export function useDataQuery<T>({ 
  key, 
  fetcher, 
  refetchInterval = 0,
  enabled = true 
}: UseDataQueryOptions<T>) {
  const cacheKey = typeof key === 'string' ? key : JSON.stringify(key)
  const [data, setData] = useState<T | null>(globalCache[cacheKey]?.data || null)
  const [isLoading, setIsLoading] = useState(!globalCache[cacheKey])
  const [error, setError] = useState<Error | null>(null)

  const fetcherRef = useRef(fetcher)
  
  // Mantém sempre a última versão da função `fetcher` sem disparar side effects.
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true)
    try {
      const result = await fetcherRef.current()
      const entry = { data: result, timestamp: Date.now() }
      globalCache[cacheKey] = entry
      persist(cacheKey, entry)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [cacheKey])

  useEffect(() => {
    if (enabled) {
      if (globalCache[cacheKey]) {
        if (data !== globalCache[cacheKey].data) {
          setData(globalCache[cacheKey].data)
        }
        setIsLoading(false)
        fetchData(true)
      } else {
        // Quando a chave muda, NÃO defina null. Mantém o dado anterior e apenas liga o loading state.
        fetchData()
      }
    }
  }, [enabled, cacheKey, fetchData])

  // Refetch opcional
  useEffect(() => {
    if (enabled && refetchInterval > 0) {
      const interval = setInterval(() => fetchData(true), refetchInterval)
      return () => clearInterval(interval)
    }
  }, [enabled, refetchInterval, fetchData])

  return { data, isLoading, error, refetch: () => fetchData() }
}
