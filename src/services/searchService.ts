import type { BusinessResult, LeadCategory } from '@/types'

export interface SearchParams {
  query?: string
  category: LeadCategory
  city?: string
  state?: string
  cep?: string
  limit?: number
  radiusKm?: number
  withContact?: boolean
  wantEmail?: boolean
  /** Modo escala (~10x): delays mínimos, sem visitar sites p/ e-mail */
  fast?: boolean
  jobId?: string
  /** google = extrai do Google Maps (padrão); osm = mapa público */
  source?: 'google' | 'osm'
}

export type SearchStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'geo'; geo: string; city: string; state: string; lat: number; lng: number }
  | { type: 'maps_url'; url: string; embedUrl: string }
  | { type: 'place'; place: BusinessResult; index: number; totalHint: number }
  | { type: 'job'; jobId: string }
  | { type: 'done'; source: string; count: number; city: string; state: string }
  | { type: 'error'; message: string }
  | { type: 'disconnected'; message: string }

export async function controlSearchJob(
  jobId: string,
  action: 'pause' | 'resume' | 'cancel' | 'status',
) {
  const res = await fetch(
    `/api/places/search/control?jobId=${encodeURIComponent(jobId)}&action=${action}`,
  )
  if (!res.ok) throw new Error('Falha ao controlar a busca')
  return res.json()
}

/** Busca em tempo real via SSE — padrão: Google Maps. */
export function searchBusinessesStream(
  params: SearchParams,
  onEvent: (event: SearchStreamEvent) => void,
): () => void {
  const hasCep = Boolean(params.cep?.replace(/\D/g, '').length)
  const hasCity = Boolean(params.city?.trim())
  if (!hasCep && !hasCity) {
    onEvent({ type: 'error', message: 'Informe a cidade ou o CEP para buscar contatos reais.' })
    return () => undefined
  }

  const jobId =
    params.jobId ||
    `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

  const qs = new URLSearchParams({
    category: params.category,
    limit: String(params.limit ?? 20),
    withContact: params.withContact === false ? '0' : '1',
    wantEmail: params.wantEmail === false ? '0' : '1',
    fast: params.fast === false ? '0' : '1',
    source: params.source || 'google',
    jobId,
  })
  if (params.city?.trim()) qs.set('city', params.city.trim())
  if (params.state?.trim()) qs.set('state', params.state.trim())
  if (params.query?.trim()) qs.set('query', params.query.trim())
  if (params.cep?.trim()) qs.set('cep', params.cep.trim())
  if (params.radiusKm) qs.set('radiusKm', String(params.radiusKm))

  let finished = false
  let placeCount = 0
  const es = new EventSource(`/api/places/search/stream?${qs}`)

  const finish = (event?: SearchStreamEvent) => {
    if (finished) return
    finished = true
    if (event) onEvent(event)
    es.close()
  }

  es.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as SearchStreamEvent
      if (event.type === 'place') placeCount += 1
      if (event.type === 'done' || event.type === 'error') {
        finish(event)
        return
      }
      if (!finished) onEvent(event)
    } catch {
      finish({ type: 'error', message: 'Falha ao ler resposta da busca' })
    }
  }

  es.onerror = () => {
    if (finished) {
      es.close()
      return
    }
    // Não cancela o job: resultados já salvos na nuvem permanecem
    finish({
      type: 'disconnected',
      message:
        placeCount > 0
          ? `Conexão encerrada · ${placeCount} contato(s) salvos na nuvem. Você pode reabrir esta busca.`
          : 'Conexão encerrada. Clique em Buscar para tentar novamente.',
    })
  }

  // Ao sair da página: só fecha o stream — NÃO cancela a busca no servidor
  return () => {
    if (finished) return
    finished = true
    es.close()
  }
}
