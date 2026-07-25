import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin } from 'vite'

export type LeadCategory =
  | 'restaurante'
  | 'pizzaria'
  | 'hamburgueria'
  | 'grafica'
  | 'academia'
  | 'clinica'
  | 'salao_beleza'
  | 'oficina'
  | 'loja'
  | 'outros'

export interface PlaceResult {
  place_id: string
  name: string
  category: LeadCategory
  city: string
  state: string
  website: string | null
  address: string
  rating: number | null
  review_count: number | null
  phone: string | null
  email?: string | null
  lat: number | null
  lng: number | null
}

const OVERPASS_MIRRORS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

const UA = 'OpenLeadsCRM/1.0 (localhost; prospection; contact=dev@openleads.app)'

/** Queries leves (só node) — menos 504 no Overpass */
const CATEGORY_FILTERS: Record<LeadCategory, string[]> = {
  restaurante: ['node["amenity"="restaurant"]'],
  pizzaria: [
    'node["amenity"="restaurant"]["cuisine"~"pizza",i]',
    'node["amenity"="fast_food"]["cuisine"~"pizza",i]',
    'node["name"~"pizza|pizzaria",i]["amenity"~"restaurant|fast_food",i]',
  ],
  hamburgueria: [
    'node["amenity"="fast_food"]["cuisine"~"burger",i]',
    'node["name"~"burger|hambur",i]["amenity"~"restaurant|fast_food",i]',
  ],
  grafica: ['node["shop"="copyshop"]'],
  academia: ['node["leisure"="fitness_centre"]'],
  clinica: ['node["amenity"="clinic"]'],
  salao_beleza: ['node["shop"="hairdresser"]'],
  oficina: ['node["shop"="car_repair"]'],
  loja: ['node["shop"="clothes"]'],
  outros: [
    'node["shop"~"supermarket|convenience|clothes|bakery",i]',
    'node["amenity"~"fast_food|cafe|restaurant",i]',
  ],
}

const CATEGORY_TEXT: Record<LeadCategory, string> = {
  restaurante: 'restaurante',
  pizzaria: 'pizzaria',
  hamburgueria: 'hamburgueria',
  grafica: 'gráfica',
  academia: 'academia',
  clinica: 'clínica',
  salao_beleza: 'salão de beleza',
  oficina: 'oficina mecânica',
  loja: 'loja',
  outros: 'empresa',
}

interface GeoPoint {
  lat: number
  lon: number
  city: string
  state: string
  displayName: string
  cep?: string
}

const searchCache = new Map<string, { at: number; results: PlaceResult[]; source: string; city: string; state: string }>()
const CACHE_TTL_MS = 5 * 60 * 1000

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function clampLimit(value?: number) {
  if (!value || Number.isNaN(value)) return 20
  return Math.min(200, Math.max(1, Math.floor(value)))
}

function cacheKey(input: {
  category: string
  city?: string
  state?: string
  query?: string
  cep?: string
  limit?: number
  radiusKm?: number
  withContact?: boolean
}) {
  return [
    input.category,
    onlyDigits(input.cep || ''),
    (input.city || '').toLowerCase().trim(),
    (input.state || '').toLowerCase().trim(),
    (input.query || '').toLowerCase().trim(),
    String(clampLimit(input.limit)),
    String(input.radiusKm ?? 0),
    input.withContact ? '1' : '0',
  ].join('|')
}

function clampRadiusKm(value?: number, hasCep = false) {
  const fallback = hasCep ? 5 : 10
  if (!value || Number.isNaN(value)) return fallback
  return Math.min(50, Math.max(1, Math.floor(value)))
}

async function geocodeCepLight(cepRaw: string): Promise<GeoPoint> {
  const cep = onlyDigits(cepRaw)
  if (cep.length !== 8) throw new Error('CEP inválido')

  // BrasilAPI com coords — sem Nominatim (Nominatim era o gargalo)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        state?: string
        city?: string
        neighborhood?: string
        street?: string
        location?: { coordinates?: { latitude?: string | number; longitude?: string | number } }
      }
      if (data.city && data.state) {
        const lat = Number(data.location?.coordinates?.latitude)
        const lon = Number(data.location?.coordinates?.longitude)
        return {
          lat: Number.isFinite(lat) ? lat : 0,
          lon: Number.isFinite(lon) ? lon : 0,
          city: data.city,
          state: data.state,
          cep,
          displayName: [data.street, data.neighborhood, data.city, data.state, cep]
            .filter(Boolean)
            .join(', '),
        }
      }
    }
  } catch {
    // ViaCEP
  }

  const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(2500),
  })
  if (!via.ok) throw new Error(`Falha ao consultar CEP (${via.status})`)
  const data = (await via.json()) as {
    erro?: boolean
    localidade?: string
    uf?: string
    logradouro?: string
    bairro?: string
  }
  if (data.erro || !data.localidade || !data.uf) {
    throw new Error(`CEP não encontrado: ${cepRaw}`)
  }
  return {
    lat: 0,
    lon: 0,
    city: data.localidade,
    state: data.uf,
    cep,
    displayName: [data.logradouro, data.bairro, data.localidade, data.uf, cep]
      .filter(Boolean)
      .join(', '),
  }
}

async function geocodeCep(cepRaw: string): Promise<GeoPoint> {
  // Versão completa (OSM) — usada no fallback OSM
  const light = await geocodeCepLight(cepRaw)
  if (light.lat && light.lon) return light
  const geo = await geocodeCity(light.city, light.state)
  return { ...geo, cep: light.cep, displayName: `${geo.displayName} (CEP ${light.cep})` }
}

async function geocodeCity(city: string, state?: string, street?: string): Promise<GeoPoint> {
  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    addressdetails: '1',
    countrycodes: 'br',
  })
  if (street?.trim()) params.set('street', street.trim())
  params.set('city', city.trim())
  if (state?.trim()) params.set('state', state.trim())

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Geocoding falhou (${res.status})`)
  const data = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
    address?: { city?: string; town?: string; municipality?: string; state?: string; state_code?: string }
  }>
  if (!data.length) {
    throw new Error(`Cidade não encontrada: ${city}${state ? '/' + state : ''}`)
  }
  const hit = data[0]
  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    city: hit.address?.city || hit.address?.town || hit.address?.municipality || city,
    state: hit.address?.state_code || hit.address?.state || state || '',
    displayName: hit.display_name,
  }
}

function buildOverpassQuery(
  filters: string[],
  lat: number,
  lon: number,
  radiusMeters: number,
  nameHint: string | undefined,
  limit: number,
  requirePhone: boolean,
): string {
  const parts: string[] = []
  const phoneTags = requirePhone
    ? ['["phone"~".",i]', '["contact:phone"~".",i]', '["contact:mobile"~".",i]']
    : ['']

  for (const f of filters.slice(0, 3)) {
    for (const phone of phoneTags) {
      parts.push(`${f}${phone}(around:${radiusMeters},${lat},${lon});`)
    }
  }

  if (nameHint?.trim()) {
    const safe = nameHint.trim().replace(/["\\]/g, '')
    for (const phone of phoneTags) {
      parts.push(`node["name"~"${safe}",i]${phone}(around:${radiusMeters},${lat},${lon});`)
    }
  }

  // Amplia para qualquer negócio com telefone no raio (quando exigir contato)
  if (requirePhone) {
    const catHint = filters[0]?.includes('restaurant') || filters[0]?.includes('pizza')
      ? 'node["amenity"~"restaurant|fast_food|cafe",i]'
      : 'node["amenity"]'
    parts.push(`${catHint}["phone"~".",i](around:${radiusMeters},${lat},${lon});`)
    parts.push(`${catHint}["contact:phone"~".",i](around:${radiusMeters},${lat},${lon});`)
  }

  const outLimit = Math.min(50, Math.max(limit * 3, 15))

  return `
[out:json][timeout:15];
(
  ${parts.join('\n  ')}
);
out body ${outLimit};
`.trim()
}

interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 12000, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Extrai tipo/id OSM do place_id. */
function parseOsmRef(placeId: string): { type: 'node' | 'way' | 'relation'; id: string } | null {
  const photon = placeId.match(/^photon_([NWR])_(\d+)$/)
  if (photon) {
    return {
      type: photon[1] === 'N' ? 'node' : photon[1] === 'W' ? 'way' : 'relation',
      id: photon[2],
    }
  }
  const osm = placeId.match(/^osm_(node|way|relation)_(\d+)$/)
  if (osm) return { type: osm[1] as 'node' | 'way' | 'relation', id: osm[2] }
  return null
}

/**
 * Enriquece em massa: tenta Overpass por IDs; se falhar, API OSM em paralelo.
 * Emite cada contato com telefone assim que encontra (streaming).
 */
async function enrichWithOsmPhonesStream(
  places: PlaceResult[],
  limit: number,
  onFound: (place: PlaceResult) => void,
): Promise<PlaceResult[]> {
  const enriched: PlaceResult[] = []
  const byKey = new Map<string, PlaceResult>()

  for (const p of places) {
    const ref = parseOsmRef(p.place_id)
    if (!ref) continue
    byKey.set(`${ref.type}/${ref.id}`, p)
  }

  const entries = [...byKey.entries()]
  const BATCH = 30

  const pushFound = (item: PlaceResult) => {
    if (enriched.length >= limit) return
    if (enriched.some((e) => e.name.toLowerCase() === item.name.toLowerCase())) return
    enriched.push(item)
    onFound(item)
  }

  for (let i = 0; i < entries.length && enriched.length < limit; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    const nodeIds = batch
      .filter(([k]) => k.startsWith('node/'))
      .map(([, p]) => parseOsmRef(p.place_id)!.id)
    const wayIds = batch
      .filter(([k]) => k.startsWith('way/'))
      .map(([, p]) => parseOsmRef(p.place_id)!.id)

    let gotFromOverpass = false
    const parts: string[] = []
    if (nodeIds.length) parts.push(`node(id:${nodeIds.join(',')});`)
    if (wayIds.length) parts.push(`way(id:${wayIds.join(',')});`)

    if (parts.length) {
      const ql = `
[out:json][timeout:10];
(
  ${parts.join('\n  ')}
);
out tags;
`.trim()
      try {
        const elements = await queryOverpassFast(ql, 9000)
        gotFromOverpass = elements.length > 0
        for (const el of elements) {
          if (enriched.length >= limit) break
          const key = `${el.type}/${el.id}`
          const base = byKey.get(key)
          if (!base) continue
          const phone = pickTag(el.tags, ['phone', 'contact:phone', 'contact:mobile', 'mobile'])
          if (!phone) continue
          pushFound({
            ...base,
            phone,
            website: pickTag(el.tags, ['website', 'contact:website', 'url']) || base.website,
            place_id: `osm_${el.type}_${el.id}`,
          })
        }
      } catch {
        gotFromOverpass = false
      }
    }

    // Fallback rápido: API OSM oficial em paralelo (10 por vez)
    if (!gotFromOverpass || enriched.length < Math.min(3, limit)) {
      const slice = batch.slice(0, 20)
      const lookups = slice.map(async ([, place]) => {
        const ref = parseOsmRef(place.place_id)
        if (!ref) return null
        try {
          const res = await fetchWithTimeout(
            `https://api.openstreetmap.org/api/0.6/${ref.type}/${ref.id}.json`,
            { timeoutMs: 6000, headers: { 'User-Agent': UA, Accept: 'application/json' } },
          )
          if (!res.ok) return null
          const json = (await res.json()) as {
            elements?: Array<{ tags?: Record<string, string> }>
          }
          const tags = json.elements?.[0]?.tags
          const phone = pickTag(tags, ['phone', 'contact:phone', 'contact:mobile', 'mobile'])
          if (!phone) return null
          return {
            ...place,
            phone,
            website: pickTag(tags, ['website', 'contact:website', 'url']) || place.website,
            place_id: `osm_${ref.type}_${ref.id}`,
          } satisfies PlaceResult
        } catch {
          return null
        }
      })

      // processa em paralelo em grupos de 10
      for (let j = 0; j < lookups.length && enriched.length < limit; j += 10) {
        const found = await Promise.all(lookups.slice(j, j + 10))
        for (const item of found) {
          if (item) pushFound(item)
        }
      }
    }
  }

  return enriched
}

/** Dispara todos os espelhos em paralelo; o primeiro OK vence. */
async function queryOverpassFast(ql: string, timeoutMs = 9000): Promise<OsmElement[]> {
  const errors: string[] = []

  const tasks = OVERPASS_MIRRORS.map(async (mirror) => {
    const res = await fetchWithTimeout(mirror, {
      method: 'POST',
      timeoutMs,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(ql)}`,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { elements?: OsmElement[] }
    return json.elements ?? []
  })

  const result = await Promise.any(tasks).catch((err: unknown) => {
    if (err instanceof AggregateError) {
      for (const e of err.errors) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
    return null
  })

  if (result) return result
  throw new Error(`Overpass indisponível (${errors[0] || 'timeout'})`)
}

async function searchNominatimFallback(input: {
  category: LeadCategory
  city: string
  state: string
  query?: string
  lat: number
  lon: number
  limit: number
}): Promise<PlaceResult[]> {
  const term = [input.query, CATEGORY_TEXT[input.category], input.city, input.state]
    .filter(Boolean)
    .join(' ')

  // ~0.05° ≈ 5km
  const delta = 0.06
  const params = new URLSearchParams({
    q: term,
    format: 'json',
    addressdetails: '1',
    limit: String(Math.min(input.limit, 80)),
    countrycodes: 'br',
    viewbox: `${input.lon - delta},${input.lat + delta},${input.lon + delta},${input.lat - delta}`,
    bounded: '1',
  })

  const res = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      timeoutMs: 12000,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    },
  )
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)

  let data = (await res.json()) as Array<{
    place_id: number
    osm_id?: number
    osm_type?: string
    lat: string
    lon: string
    display_name: string
    name?: string
    address?: {
      city?: string
      town?: string
      municipality?: string
      state?: string
      road?: string
      suburb?: string
      postcode?: string
    }
  }>

  // Se o viewbox veio vazio, tenta sem bounded
  if (!data.length) {
    params.delete('viewbox')
    params.delete('bounded')
    const res2 = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        timeoutMs: 12000,
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      },
    )
    if (res2.ok) {
      data = (await res2.json()) as typeof data
    }
  }

  const seen = new Set<string>()
  const results: PlaceResult[] = []

  for (const hit of data) {
    const name =
      hit.name ||
      hit.display_name.split(',')[0]?.trim() ||
      'Estabelecimento'
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const city =
      hit.address?.city || hit.address?.town || hit.address?.municipality || input.city
    const state = hit.address?.state || input.state
    const address = [
      [hit.address?.road, hit.address?.suburb].filter(Boolean).join(' — '),
      `${city}/${state}`,
      hit.address?.postcode,
    ]
      .filter(Boolean)
      .join(' · ')

    results.push({
      place_id: `nom_${hit.place_id}`,
      name,
      category: input.category,
      city,
      state: state.slice(0, 2).toUpperCase() === state.toUpperCase() ? state.toUpperCase() : state,
      website: null,
      address: address || hit.display_name,
      rating: null,
      review_count: null,
      phone: null,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    })
  }

  return results.slice(0, input.limit)
}

async function searchPhotonFallback(input: {
  category: LeadCategory
  city: string
  state: string
  query?: string
  lat: number
  lon: number
  limit: number
  /** Se true, usa `query` literal (já montada pelo caller) */
  exactQuery?: boolean
}): Promise<PlaceResult[]> {
  const term = input.exactQuery && input.query?.trim()
    ? input.query.trim()
    : [input.query, CATEGORY_TEXT[input.category], input.city]
        .filter(Boolean)
        .join(' ')

  if (!term.trim()) return []

  const params = new URLSearchParams({
    q: term,
    limit: String(Math.min(input.limit, 50)),
    lat: String(input.lat),
    lon: String(input.lon),
    lang: 'en',
  })

  const res = await fetchWithTimeout(`https://photon.komoot.io/api/?${params}`, {
    timeoutMs: 8000,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] }
      properties?: {
        osm_id?: number
        osm_type?: string
        name?: string
        street?: string
        housenumber?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
      }
    }>
  }

  const seen = new Set<string>()
  const results: PlaceResult[] = []

  for (const feat of data.features || []) {
    const p = feat.properties || {}
    const name = p.name?.trim()
    if (!name) continue
    if (p.country && !/brazil|brasil/i.test(p.country) && p.country.length > 2) continue

    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const [lng, lat] = feat.geometry?.coordinates || [null, null]
    const city = p.city || input.city
    const state = p.state || input.state
    const address = [
      [p.street, p.housenumber].filter(Boolean).join(', '),
      `${city}/${state}`,
      p.postcode,
    ]
      .filter(Boolean)
      .join(' · ')

    results.push({
      place_id: `photon_${p.osm_type || 'x'}_${p.osm_id || name}`,
      name,
      category: input.category,
      city,
      state: String(state).slice(0, 2).toUpperCase() === String(state).toUpperCase()
        ? String(state).toUpperCase()
        : String(state),
      website: null,
      address,
      rating: null,
      review_count: null,
      phone: null,
      lat: lat ?? null,
      lng: lng ?? null,
    })
  }

  return results.slice(0, input.limit)
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/aborted|AbortError/i.test(msg) || msg === 'This operation was aborted') {
    return 'A busca demorou demais. Tente de novo com 10 contatos ou só o CEP.'
  }
  if (/504|502|503|indisponível|timeout/i.test(msg)) {
    return 'Servidores de mapa congestionado. Tentando fontes alternativas...'
  }
  return msg
}

function pickTag(tags: Record<string, string> | undefined, keys: string[]): string | null {
  if (!tags) return null
  for (const k of keys) {
    const v = tags[k]?.trim()
    if (v) return v
  }
  return null
}

function buildAddress(tags: Record<string, string> | undefined, city: string, state: string): string {
  if (!tags) return `${city}/${state}`
  const street = pickTag(tags, ['addr:street', 'street'])
  const number = pickTag(tags, ['addr:housenumber'])
  const suburb = pickTag(tags, ['addr:suburb', 'addr:neighbourhood'])
  const parts = [
    [street, number].filter(Boolean).join(', '),
    suburb,
    `${city}/${state}`,
  ].filter(Boolean)
  return parts.join(' — ')
}

function mapElements(
  elements: OsmElement[],
  category: LeadCategory,
  city: string,
  state: string,
  nameHint: string | undefined,
  limit: number,
): PlaceResult[] {
  const hint = nameHint?.trim().toLowerCase()
  const seen = new Set<string>()
  const results: PlaceResult[] = []

  for (const el of elements) {
    const tags = el.tags
    const name = pickTag(tags, ['name', 'name:pt', 'brand', 'operator'])
    if (!name) continue
    if (hint && !name.toLowerCase().includes(hint) && !(tags?.cuisine || '').toLowerCase().includes(hint)) {
      if (hint.length > 2 && !JSON.stringify(tags || {}).toLowerCase().includes(hint)) continue
    }

    const key = `${name.toLowerCase()}|${pickTag(tags, ['phone', 'contact:phone']) || el.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const lat = el.lat ?? el.center?.lat ?? null
    const lng = el.lon ?? el.center?.lon ?? null

    results.push({
      place_id: `osm_${el.type}_${el.id}`,
      name,
      category,
      city,
      state: state.slice(0, 2).toUpperCase() === state.toUpperCase() ? state.toUpperCase() : state,
      website: pickTag(tags, ['website', 'contact:website', 'url', 'contact:facebook']),
      address: buildAddress(tags, city, state),
      rating: null,
      review_count: null,
      phone: pickTag(tags, ['phone', 'contact:phone', 'contact:mobile', 'mobile']),
      email: pickTag(tags, ['email', 'contact:email']),
      lat,
      lng,
    })
  }

  results.sort((a, b) => {
    const score = (x: PlaceResult) =>
      (x.phone ? 2 : 0) + (x.email ? 2 : 0) + (x.website ? 1 : 0)
    return score(b) - score(a)
  })

  return results.slice(0, limit)
}

export type SearchProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'geo'; geo: string; city: string; state: string; lat: number; lng: number }
  | { type: 'maps_url'; url: string; embedUrl: string }
  | { type: 'place'; place: PlaceResult; index: number; totalHint: number }
  | { type: 'job'; jobId: string }
  | { type: 'done'; source: string; count: number; city: string; state: string }
  | { type: 'error'; message: string }

export async function searchRealPlaces(input: {
  category: LeadCategory
  city?: string
  state?: string
  query?: string
  cep?: string
  limit?: number
}): Promise<{
  results: PlaceResult[]
  source: string
  geo: string
  city: string
  state: string
  lat: number
  lng: number
}> {
  const results: PlaceResult[] = []

  await searchRealPlacesStream(input, (event) => {
    if (event.type === 'place') {
      results.push(event.place)
    }
    if (event.type === 'error') throw new Error(event.message)
  })

  const geoEventCity = results[0]?.city || input.city || ''
  const geoEventState = results[0]?.state || input.state || ''

  return {
    results,
    source: input.cep
      ? `OpenStreetMap · CEP ${onlyDigits(input.cep)}`
      : 'OpenStreetMap (dados públicos reais)',
    geo: results[0]?.address || geoEventCity,
    city: geoEventCity,
    state: geoEventState,
    lat: results[0]?.lat ?? 0,
    lng: results[0]?.lng ?? 0,
  }
}

export async function searchRealPlacesStream(
  input: {
    category: LeadCategory
    city?: string
    state?: string
    query?: string
    cep?: string
    limit?: number
    radiusKm?: number
    withContact?: boolean
  },
  onEvent: (event: SearchProgressEvent) => void,
): Promise<void> {
  const limit = clampLimit(input.limit)
  const hasCep = Boolean(input.cep && onlyDigits(input.cep).length >= 8)
  const hasCity = Boolean(input.city?.trim())
  const withContact = input.withContact !== false // padrão: prioriza com contato
  const radiusKm = clampRadiusKm(input.radiusKm, hasCep)
  const radiusMeters = radiusKm * 1000

  if (!hasCep && !hasCity) {
    onEvent({ type: 'error', message: 'Informe a cidade ou o CEP para buscar contatos reais.' })
    return
  }

  const key = cacheKey({ ...input, radiusKm, withContact, limit })
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    onEvent({ type: 'status', message: 'Resultados em cache (rápido)...' })
    onEvent({
      type: 'geo',
      geo: `${cached.city}/${cached.state}`,
      city: cached.city,
      state: cached.state,
      lat: cached.results[0]?.lat ?? 0,
      lng: cached.results[0]?.lng ?? 0,
    })
    for (let i = 0; i < cached.results.length; i++) {
      onEvent({
        type: 'place',
        place: cached.results[i],
        index: i + 1,
        totalHint: cached.results.length,
      })
    }
    onEvent({
      type: 'done',
      source: `${cached.source} · cache`,
      count: cached.results.length,
      city: cached.city,
      state: cached.state,
    })
    return
  }

  onEvent({ type: 'status', message: hasCep ? 'Localizando CEP...' : 'Localizando cidade...' })

  let geo: GeoPoint
  try {
    geo = hasCep
      ? await geocodeCep(input.cep!)
      : await geocodeCity(input.city!, input.state)
  } catch (err) {
    onEvent({ type: 'error', message: friendlyError(err) })
    return
  }

  onEvent({
    type: 'geo',
    geo: geo.displayName,
    city: geo.city,
    state: geo.state,
    lat: geo.lat,
    lng: geo.lon,
  })

  const city = geo.city || input.city || ''
  const state = geo.state || input.state || ''
  const categoryLabel = input.category.replace(/_/g, ' ')
  const rawQuery = input.query?.trim() || ''
  const nameHint =
    rawQuery &&
    !categoryLabel.includes(rawQuery.toLowerCase()) &&
    rawQuery.toLowerCase() !== input.category &&
    rawQuery.toLowerCase() !== CATEGORY_TEXT[input.category]
      ? rawQuery
      : undefined

  let results: PlaceResult[] = []
  let source = 'extração rápida'
  const seenNames = new Set<string>()
  const filters = CATEGORY_FILTERS[input.category] ?? CATEGORY_FILTERS.outros
  const searchTerm = nameHint || rawQuery || undefined
  const candidateLimit = Math.min(80, Math.max(limit * 3, 40))

  const emitPlace = (place: PlaceResult) => {
    const nk = place.name.toLowerCase()
    if (seenNames.has(nk) || results.length >= limit) return false
    if (withContact && !place.phone) return false
    seenNames.add(nk)
    results.push(place)
    onEvent({
      type: 'place',
      place,
      index: results.length,
      totalHint: limit,
    })
    return true
  }

  onEvent({
    type: 'status',
    message: `Extração em massa · ${radiusKm} km · até ${limit} contatos...`,
  })

  // Dispara Overpass + Photon em PARALELO (não espera um pelo outro)
  const overpassPromise = (async () => {
    try {
      const ql = buildOverpassQuery(
        filters,
        geo.lat,
        geo.lon,
        radiusMeters,
        searchTerm,
        limit,
        withContact,
      )
      const collected = await queryOverpassFast(ql, 8000)
      return mapElements(collected, input.category, city, state, searchTerm, limit * 2)
    } catch {
      return [] as PlaceResult[]
    }
  })()

  const photonTerms = [
    [searchTerm, CATEGORY_TEXT[input.category], city].filter(Boolean).join(' '),
    [CATEGORY_TEXT[input.category], city, state].filter(Boolean).join(' '),
    searchTerm ? `${searchTerm} ${city}` : `${CATEGORY_TEXT[input.category]} ${city}`,
  ]

  const photonPromise = Promise.all(
    [...new Set(photonTerms)].slice(0, 3).map((q) =>
      searchPhotonFallback({
        category: input.category,
        city,
        state,
        query: q,
        exactQuery: true,
        lat: geo.lat,
        lon: geo.lon,
        limit: candidateLimit,
      }).catch(() => [] as PlaceResult[]),
    ),
  ).then((lists) => {
    const merged: PlaceResult[] = []
    const s = new Set<string>()
    for (const list of lists) {
      for (const p of list) {
        const k = p.name.toLowerCase()
        if (s.has(k)) continue
        s.add(k)
        merged.push(p)
      }
    }
    return merged
  })

  const nominatimPromise = searchNominatimFallback({
    category: input.category,
    city,
    state,
    query: searchTerm,
    lat: geo.lat,
    lon: geo.lon,
    limit: candidateLimit,
  }).catch(() => [] as PlaceResult[])

  onEvent({ type: 'status', message: 'Consultando fontes em paralelo...' })

  const [overpassHits, photonHits, nominatimHits] = await Promise.all([
    overpassPromise,
    photonPromise,
    nominatimPromise,
  ])

  // 1) Emite imediatamente o que já veio com telefone do Overpass
  for (const p of overpassHits) {
    if (results.length >= limit) break
    if (withContact && !p.phone) continue
    emitPlace(p)
  }
  if (overpassHits.some((p) => p.phone)) {
    source = `Overpass · com telefone · ${radiusKm} km`
  }

  // 2) Une Photon + Nominatim e enriquece em lote (streaming)
  if (results.length < limit) {
    const maxDeg = (radiusKm * 1.8) / 111
    const pool = [...photonHits, ...nominatimHits]
    const nearby = pool.filter((c) => {
      if (c.lat == null || c.lng == null) return true
      return Math.abs(c.lat - geo.lat) <= maxDeg && Math.abs(c.lng - geo.lon) <= maxDeg
    })

    onEvent({
      type: 'status',
      message: `Validando telefones em lote (${nearby.length} candidatos)...`,
    })

    const remaining = limit - results.length
    if (withContact) {
      await enrichWithOsmPhonesStream(nearby, remaining + 5, (place) => {
        if (results.length < limit) {
          emitPlace(place)
          source = `extração rápida · telefones · ${radiusKm} km`
        }
      })
    } else {
      for (const p of nearby) {
        if (results.length >= limit) break
        emitPlace(p)
      }
      if (nearby.length) source = `Photon/Nominatim · ${radiusKm} km`
    }
  }

  // 3) Se ainda faltou e quer telefone: Overpass amplo (uma vez só, timeout curto)
  if (withContact && results.length < Math.min(5, limit)) {
    onEvent({ type: 'status', message: 'Complementando com busca ampla de telefones...' })
    try {
      const safe = (searchTerm || CATEGORY_TEXT[input.category]).replace(/["\\]/g, '')
      const ql = `
[out:json][timeout:10];
(
  node["phone"~".",i](around:${radiusMeters},${geo.lat},${geo.lon});
  node["contact:phone"~".",i](around:${radiusMeters},${geo.lat},${geo.lon});
  node["name"~"${safe}",i]["phone"~".",i](around:${Math.round(radiusMeters * 1.5)},${geo.lat},${geo.lon});
);
out body ${Math.min(60, limit * 2)};
`.trim()
      const collected = await queryOverpassFast(ql, 8000)
      const mapped = mapElements(collected, input.category, city, state, undefined, limit * 2)
      for (const p of mapped) {
        if (results.length >= limit) break
        emitPlace(p)
      }
      if (mapped.some((p) => p.phone)) source = `Overpass amplo · ${radiusKm} km`
    } catch {
      // ok
    }
  }

  if (!results.length) {
    onEvent({
      type: 'error',
      message: withContact
        ? `Nenhum estabelecimento com telefone em ${radiusKm} km. Aumente o raio ou desmarque "somente com telefone".`
        : 'Nenhum contato encontrado. Aumente o raio (km) ou tente outro CEP/cidade.',
    })
    return
  }

  searchCache.set(key, { at: Date.now(), results, source, city, state })

  onEvent({
    type: 'done',
    source,
    count: results.length,
    city,
    state,
  })
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function parseSearchParams(source: {
  category?: string
  city?: string
  state?: string
  query?: string
  cep?: string
  limit?: string | number
  radiusKm?: string | number
  withContact?: string | boolean
}) {
  const withContactRaw = source.withContact
  const withContact =
    withContactRaw === undefined || withContactRaw === null
      ? true
      : withContactRaw === true ||
        withContactRaw === '1' ||
        withContactRaw === 'true'

  return {
    category: (source.category as LeadCategory) || 'restaurante',
    city: source.city || '',
    state: source.state || '',
    query: source.query || '',
    cep: source.cep || '',
    limit: Number(source.limit ?? 20),
    radiusKm: Number(source.radiusKm ?? 0) || undefined,
    withContact,
  }
}

export function placesApiPlugin(): Plugin {
  return {
    name: 'openleads-places-api',
    configureServer(server) {
      // Pré-aquece Chromium no boot (primeira busca fica rápida)
      void import('./googleMapsScraper.js')
        .then((m) => m.warmBrowser())
        .catch(() => undefined)

      server.middlewares.use((req, res, next) => {
        void handlePlacesApi(req, res, next)
      })
    },
  }
}

/** Middleware Connect/Vite/Vercel para /api/places/* */
export async function handlePlacesApi(
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
) {
  if (!req.url?.startsWith('/api/places/')) {
    next?.()
    return
  }

        // Controle pausar / continuar / cancelar
        if (req.url.startsWith('/api/places/search/control')) {
          try {
            const url = new URL(req.url, 'http://localhost')
            const jobId = url.searchParams.get('jobId') || ''
            const action = url.searchParams.get('action') || ''
            const { createScrapeJob, setScrapeJobPaused, cancelScrapeJob, getScrapeJob } =
              await import('./scrapeJobs.js')

            if (!jobId) return sendJson(res, 400, { error: 'jobId obrigatório' })

            if (action === 'create') {
              createScrapeJob(jobId)
              return sendJson(res, 200, { ok: true, jobId })
            }
            if (action === 'pause') {
              const ok = setScrapeJobPaused(jobId, true)
              return sendJson(res, ok ? 200 : 404, { ok, paused: true })
            }
            if (action === 'resume') {
              const ok = setScrapeJobPaused(jobId, false)
              return sendJson(res, ok ? 200 : 404, { ok, paused: false })
            }
            if (action === 'cancel') {
              const ok = cancelScrapeJob(jobId)
              return sendJson(res, ok ? 200 : 404, { ok, cancelled: true })
            }
            if (action === 'status') {
              const job = getScrapeJob(jobId)
              return sendJson(res, 200, { job })
            }
            return sendJson(res, 400, { error: 'action inválida' })
          } catch (err) {
            return sendJson(res, 500, {
              error: err instanceof Error ? err.message : 'Erro no controle',
            })
          }
        }

        if (!req.url.startsWith('/api/places/search')) {
          next?.()
          return
        }

        const isStream = req.url.startsWith('/api/places/search/stream')

        try {
          if (isStream) {
            if (req.method !== 'GET') {
              return sendJson(res, 405, { error: 'Use GET no stream' })
            }

            const url = new URL(req.url, 'http://localhost')
            const params = parseSearchParams({
              category: url.searchParams.get('category') || undefined,
              city: url.searchParams.get('city') || undefined,
              state: url.searchParams.get('state') || undefined,
              query: url.searchParams.get('query') || undefined,
              cep: url.searchParams.get('cep') || undefined,
              limit: url.searchParams.get('limit') || undefined,
              radiusKm: url.searchParams.get('radiusKm') || undefined,
              withContact: url.searchParams.get('withContact') || undefined,
            })
            const wantEmail = url.searchParams.get('wantEmail') !== '0'
            const fast = url.searchParams.get('fast') !== '0'
            const jobId =
              url.searchParams.get('jobId') ||
              `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

            const { createScrapeJob } = await import('./scrapeJobs.js')
            createScrapeJob(jobId)

            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive',
            })

            const send = (event: SearchProgressEvent) => {
              if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify(event)}\n\n`)
              }
            }

            send({ type: 'job', jobId })

            try {
              const sourceMode = url.searchParams.get('source') || 'google'
              if (sourceMode === 'google') {
                const { scrapeGoogleMapsPlaces, warmBrowser } = await import('./googleMapsScraper.js')

                // Chromium em paralelo com a localização (acaba com a espera "abrindo Maps")
                const browserWarm = warmBrowser()

                let lat: number | undefined
                let lng: number | undefined
                let cityName = params.city
                let stateName = params.state

                send({ type: 'status', message: 'Preparando busca…' })

                const formCity = (params.city || '').trim()
                const formState = (params.state || '').trim()

                // CEP só localiza se NÃO conflitar com a cidade digitada
                // (ex.: CEP de SP + cidade São Gonçalo/RJ quebrava a busca)
                if (params.cep && onlyDigits(params.cep).length === 8) {
                  try {
                    const geo = await geocodeCepLight(params.cep)
                    const norm = (s: string) =>
                      s
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/\p{M}/gu, '')
                    const cepCity = geo.city || ''
                    const sameCity =
                      !formCity ||
                      norm(formCity).includes(norm(cepCity)) ||
                      norm(cepCity).includes(norm(formCity))

                    if (sameCity) {
                      cityName = geo.city || formCity
                      stateName = geo.state || formState
                      if (geo.lat && geo.lon) {
                        lat = geo.lat
                        lng = geo.lon
                      }
                    } else {
                      // Conflito: prioriza cidade do formulário, ignora coords do CEP
                      cityName = formCity || geo.city
                      stateName = formState || geo.state
                      send({
                        type: 'status',
                        message: `CEP é de ${geo.city}/${geo.state} · buscando em ${cityName}/${stateName}`,
                      })
                    }
                    send({
                      type: 'geo',
                      geo: sameCity
                        ? geo.displayName
                        : [cityName, stateName].filter(Boolean).join(', '),
                      city: cityName,
                      state: stateName,
                      lat: lat || 0,
                      lng: lng || 0,
                    })
                  } catch {
                    cityName = formCity
                    stateName = formState
                  }
                } else if (formCity) {
                  cityName = formCity
                  stateName = formState
                  send({
                    type: 'geo',
                    geo: [formCity, formState].filter(Boolean).join(', '),
                    city: formCity,
                    state: formState,
                    lat: 0,
                    lng: 0,
                  })
                }

                await browserWarm

                let googleCount = 0
                let googleDone = false
                await scrapeGoogleMapsPlaces(
                  {
                    category: params.category,
                    city: cityName || params.city,
                    state: stateName || params.state,
                    query: params.query,
                    lat,
                    lng,
                    limit: params.limit,
                    withContact: params.withContact,
                    jobId,
                    wantEmail,
                    fast,
                  },
                  (ev: {
                    type: string
                    message?: string
                    url?: string
                    embedUrl?: string
                    place?: PlaceResult
                    index?: number
                    totalHint?: number
                    count?: number
                  }) => {
                    if (ev.type === 'status' && ev.message) {
                      send({ type: 'status', message: ev.message })
                    }
                    if (ev.type === 'maps_url' && ev.url && ev.embedUrl) {
                      send({ type: 'maps_url', url: ev.url, embedUrl: ev.embedUrl })
                    }
                    if (ev.type === 'place' && ev.place && ev.index != null && ev.totalHint != null) {
                      googleCount = ev.index
                      send({
                        type: 'place',
                        place: ev.place,
                        index: ev.index,
                        totalHint: ev.totalHint,
                      })
                    }
                    if (ev.type === 'done' && ev.count != null) {
                      googleDone = true
                      send({
                        type: 'done',
                        source: 'Google Maps',
                        count: ev.count,
                        city: cityName || params.city,
                        state: stateName || params.state,
                      })
                    }
                    if (ev.type === 'error' && ev.message) {
                      send({ type: 'error', message: ev.message })
                    }
                  },
                )

                if (googleCount > 0 && !googleDone) {
                  send({
                    type: 'done',
                    source: 'Google Maps',
                    count: googleCount,
                    city: cityName || params.city,
                    state: stateName || params.state,
                  })
                } else if (googleCount === 0 && !googleDone) {
                  // Sem fallback OSM lento — mantém busca no Google Maps
                  send({
                    type: 'error',
                    message:
                      'Não foi possível capturar contatos no Maps. Confira cidade/UF (e CEP da mesma cidade), aumente o raio ou tente de novo.',
                  })
                }
              } else {
                await searchRealPlacesStream(params, send)
              }
            } catch (err) {
              send({ type: 'error', message: friendlyError(err) })
            }
            if (!res.writableEnded) res.end()
            return
          }

          let params = parseSearchParams({})

          if (req.method === 'GET') {
            const url = new URL(req.url, 'http://localhost')
            params = parseSearchParams({
              category: url.searchParams.get('category') || undefined,
              city: url.searchParams.get('city') || undefined,
              state: url.searchParams.get('state') || undefined,
              query: url.searchParams.get('query') || undefined,
              cep: url.searchParams.get('cep') || undefined,
              limit: url.searchParams.get('limit') || undefined,
              radiusKm: url.searchParams.get('radiusKm') || undefined,
              withContact: url.searchParams.get('withContact') || undefined,
            })
          } else if (req.method === 'POST') {
            const raw = await readBody(req)
            const body = JSON.parse(raw || '{}') as Record<string, string | number | boolean>
            params = parseSearchParams(body)
          } else {
            return sendJson(res, 405, { error: 'Método não permitido' })
          }

          const results: PlaceResult[] = []
          let meta = {
            source: 'OpenStreetMap',
            geo: '',
            city: params.city,
            state: params.state,
            lat: 0,
            lng: 0,
          }

          await searchRealPlacesStream(params, (event) => {
            if (event.type === 'geo') {
              meta = {
                ...meta,
                geo: event.geo,
                city: event.city,
                state: event.state,
                lat: event.lat,
                lng: event.lng,
              }
            }
            if (event.type === 'place') results.push(event.place)
            if (event.type === 'done') {
              meta.source = event.source
              meta.city = event.city
              meta.state = event.state
            }
            if (event.type === 'error') throw new Error(event.message)
          })

          return sendJson(res, 200, { results, ...meta })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro na busca'
          if (!res.headersSent) {
            return sendJson(res, 500, { error: message, results: [] })
          }
          res.end()
        }
}
