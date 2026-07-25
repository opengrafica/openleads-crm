import { chromium, type Browser, type Page } from 'playwright'
import { isJobCancelled, waitIfPaused } from './scrapeJobs.js'

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
  email: string | null
  lat: number | null
  lng: number | null
}

export type GoogleScrapeEvent =
  | { type: 'status'; message: string }
  | { type: 'maps_url'; url: string; embedUrl: string }
  | { type: 'place'; place: PlaceResult; index: number; totalHint: number }
  | { type: 'done'; count: number }
  | { type: 'error'; message: string }

const CATEGORY_TEXT: Record<LeadCategory, string> = {
  restaurante: 'restaurante',
  pizzaria: 'pizzaria',
  hamburgueria: 'hamburgueria',
  grafica: 'gráfica',
  academia: 'academia',
  clinica: 'clínica',
  salao_beleza: 'salão de beleza',
  oficina: 'oficina',
  loja: 'loja',
  outros: '',
}

const BAD_NAMES =
  /^(resultados|patrocinado|sponsored|anúncio|anuncio|ads?)[\s?.!]*$/i

function isBadName(name: string | null | undefined) {
  if (!name) return true
  const t = name.trim()
  if (t.length < 2) return true
  if (BAD_NAMES.test(t)) return true
  if (/^patrocinado\b/i.test(t) && t.length < 18) return true
  if (/\bem breve\b/i.test(t)) return true
  if (/^\(?\s*em breve/i.test(t)) return true
  return false
}

function buildSearchQuery(input: {
  category: LeadCategory
  city: string
  state?: string
  query?: string
}) {
  if (input.query?.trim()) {
    return [input.query.trim(), input.city, input.state].filter(Boolean).join(' ')
  }
  const cat = CATEGORY_TEXT[input.category]
  return [cat, input.city, input.state].filter(Boolean).join(' ')
}

export function buildGoogleMapsUrls(input: {
  category: LeadCategory
  city: string
  state?: string
  query?: string
  lat?: number
  lng?: number
  zoom?: number
  placeName?: string
}) {
  const q = input.placeName
    ? `${input.placeName} ${input.city}`
    : buildSearchQuery(input)
  const zoom = input.zoom ?? 14
  const searchPath = `https://www.google.com/maps/search/${encodeURIComponent(q)}`
  const hasCoords =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng) &&
    Math.abs(input.lat) > 0.1 &&
    Math.abs(input.lng) > 0.1
  const withCoords = hasCoords
    ? `${searchPath}/@${input.lat},${input.lng},${zoom}z`
    : searchPath
  const url = `${withCoords}?hl=pt-BR`
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=pt-BR&z=${zoom}&output=embed`
  return { q, url, embedUrl }
}

function cleanPhone(text: string | null | undefined): string | null {
  if (!text) return null
  const normalized = text
    .replace(/telefone[:\s]*/i, '')
    .replace(/^phone:\s*/i, '')
    .trim()
  // Preferência: (XX) XXXXX-XXXX ou 0800 ...
  const preferred =
    normalized.match(/(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})/) ||
    normalized.match(/(0800\s*\d{3}\s*\d{4})/) ||
    normalized.match(/(\+?\d[\d\s().-]{7,}\d)/)
  if (!preferred) return null
  let phone = preferred[1].replace(/\s+/g, ' ').trim()
  // Corrige ") 97108..." sem o "("
  if (/^\d{2}\)\s/.test(phone)) phone = `(${phone}`
  return phone
}

function cleanEmail(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (!m) return null
  const email = m[0].toLowerCase()
  if (
    /(\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|\.css|\.js|\.map|\.woff|example\.com|sentry\.|wixpress|schema\.org|googleapis|gstatic|w3\.org)/i.test(
      email,
    )
  ) {
    return null
  }
  if (/@[\d.]+/.test(email)) return null
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return null
  return email
}

async function dismissConsent(page: Page) {
  const selectors = [
    'button:has-text("Aceitar tudo")',
    'button:has-text("Accept all")',
    'button:has-text("Concordo")',
    'button:has-text("I agree")',
  ]
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ timeout: 1000 })
        return
      }
    } catch {
      // segue
    }
  }
}

/** Volta para a lista de resultados (após abrir um lugar). */
async function backToResultsList(page: Page, searchUrl: string) {
  const hasFeed = async () =>
    (await page.locator('div[role="feed"] div[role="article"]').count()) > 0

  if (await hasFeed()) return true

  const backSelectors = [
    'button[aria-label="Voltar"]',
    'button[aria-label="Back"]',
    'button[aria-label="Back to results"]',
    'button[aria-label="Voltar aos resultados"]',
    'button.VfPpkd-icon-LgbsSe[aria-label*="oltar" i]',
  ]

  for (const sel of backSelectors) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 400 })) {
        await btn.click({ timeout: 1500 })
        await page.waitForTimeout(500)
        if (await hasFeed()) return true
      }
    } catch {
      // tenta próximo
    }
  }

  try {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    if (await hasFeed()) return true
  } catch {
    // ignore
  }

  // Último recurso: reabre a busca
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await dismissConsent(page)
  try {
    await page.waitForSelector('div[role="feed"]', { timeout: 10000 })
  } catch {
    return false
  }
  return hasFeed()
}

/**
 * Rola a barra lateral do Google Maps até carregar N resultados
 * (lazy-load da lista).
 */
async function scrollResultsFeed(
  page: Page,
  targetCount: number,
  onStatus?: (msg: string) => void,
) {
  const feed = page.locator('div[role="feed"]').first()
  if (!(await feed.count())) return 0

  let stable = 0
  let last = 0
  const maxRounds = 60

  for (let round = 0; round < maxRounds; round++) {
    const count = await page.locator('div[role="feed"] div[role="article"]').count()
    onStatus?.(`Rolando lista do Maps… ${count} resultados`)
    if (count >= targetCount) return count

    // Rola a barra lateral (feed) para baixo
    await feed.evaluate((el) => {
      const node = el as HTMLElement
      node.scrollTop = node.scrollHeight
      node.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await page.waitForTimeout(450)

    // Clique em “Mais resultados” se aparecer
    try {
      const more = page
        .locator('button:has-text("Mais resultados"), button:has-text("More results")')
        .first()
      if (await more.isVisible({ timeout: 150 })) {
        await more.click({ timeout: 800 })
        await page.waitForTimeout(600)
      }
    } catch {
      // ignore
    }

    const next = await page.locator('div[role="feed"] div[role="article"]').count()
    if (next <= last) {
      stable += 1
      if (stable >= 5) return next
    } else {
      stable = 0
      last = next
    }
  }

  return await page.locator('div[role="feed"] div[role="article"]').count()
}

async function extractPanelFast(
  page: Page,
  fallbackName: string,
): Promise<{
  name: string
  phone: string | null
  website: string | null
  email: string | null
  address: string
  rating: number | null
  reviewCount: number | null
  lat: number | null
  lng: number | null
} | null> {
  const raw = await page.evaluate((expected) => {
    const bad = /^(resultados|patrocinado|sponsored|anúncio|anuncio)/i
    let name = ''
    const h1s = Array.from(document.querySelectorAll('div[role="main"] h1'))
    for (const h of h1s) {
      const t = (h.textContent || '').trim()
      if (t && !bad.test(t)) {
        name = t
        break
      }
    }
    if (!name) {
      const alt = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge')
      const t = (alt?.textContent || '').trim()
      if (t && !bad.test(t)) name = t
    }
    if (!name && expected && !bad.test(expected)) name = expected

    const phoneBtn = document.querySelector(
      'button[data-item-id^="phone:"]',
    ) as HTMLElement | null
    let phone =
      phoneBtn?.getAttribute('aria-label') ||
      phoneBtn?.textContent ||
      phoneBtn?.getAttribute('data-item-id')?.replace(/^phone:tel:/i, '') ||
      ''
    if (!phone) {
      const tel = document.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null
      phone = tel?.getAttribute('href')?.replace(/^tel:/i, '') || tel?.textContent || ''
    }

    const web = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null
    const website = web?.href || null

    const mail = document.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null
    const email = mail?.getAttribute('href')?.replace(/^mailto:/i, '') || null

    const addrBtn = document.querySelector('button[data-item-id="address"]') as HTMLElement | null
    const address =
      addrBtn?.getAttribute('aria-label')?.replace(/^Endereço:\s*/i, '') ||
      addrBtn?.textContent ||
      ''

    let rating: number | null = null
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]')
    if (ratingEl?.textContent) {
      const r = parseFloat(ratingEl.textContent.replace(',', '.'))
      if (!Number.isNaN(r)) rating = r
    }

    let reviewCount: number | null = null
    const rev = document.querySelector(
      'div.F7nice span[aria-label*="avaliação"], div.F7nice span[aria-label*="review"]',
    )
    const rm = rev?.getAttribute('aria-label')?.replace(/\./g, '').match(/(\d+)/)
    if (rm) reviewCount = Number(rm[1])

    let lat: number | null = null
    let lng: number | null = null
    const u = location.href
    const m =
      u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) {
      lat = Number(m[1])
      lng = Number(m[2])
    }

    return { name, phone, website, email, address, rating, reviewCount, lat, lng }
  }, fallbackName)

  if (!raw?.name || isBadName(raw.name)) return null

  return {
    name: raw.name,
    phone: cleanPhone(raw.phone),
    website: raw.website,
    email: cleanEmail(raw.email),
    address: (raw.address || '').trim(),
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    lat: raw.lat,
    lng: raw.lng,
  }
}

let sharedBrowser: Browser | null = null
let warming: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser
  if (warming) return warming

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

  warming = (async () => {
    if (isServerless) {
      const serverlessChromium = (await import('@sparticuz/chromium')).default
      const { chromium: pwChromium } = await import('playwright-core')
      const executablePath = await serverlessChromium.executablePath()
      const browser = await pwChromium.launch({
        args: serverlessChromium.args,
        executablePath,
        headless: true,
      })
      sharedBrowser = browser as unknown as Browser
      return sharedBrowser
    }

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--mute-audio',
      ],
    })
    sharedBrowser = browser
    return browser
  })()
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
        throw new Error(
          'Chromium do Playwright não instalado. Rode: npx playwright install chromium',
        )
      }
      throw err
    })
    .finally(() => {
      warming = null
    })

  return warming
}

export async function warmBrowser() {
  try {
    await getBrowser()
  } catch {
    // ignora
  }
}

export async function scrapeGoogleMapsPlaces(
  input: {
    category: LeadCategory
    city: string
    state?: string
    query?: string
    lat?: number
    lng?: number
    limit?: number
    withContact?: boolean
    jobId?: string
    wantEmail?: boolean
    fast?: boolean
  },
  onEvent: (event: GoogleScrapeEvent) => void,
): Promise<void> {
  const limit = Math.min(200, Math.max(1, input.limit || 20))
  const withContact = input.withContact !== false
  const jobId = input.jobId
  const base = buildGoogleMapsUrls(input)

  onEvent({ type: 'status', message: `Abrindo Google Maps · ${base.q}` })
  onEvent({ type: 'maps_url', url: base.url, embedUrl: base.embedUrl })

  let page: Page | null = null
  try {
    const browser = await getBrowser()
    page = await browser.newPage({
      locale: 'pt-BR',
      viewport: { width: 1360, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    })

    await page.goto(base.url, { waitUntil: 'domcontentloaded', timeout: 35000 })
    await dismissConsent(page)
    await page.waitForTimeout(800)

    if (isJobCancelled(jobId)) {
      onEvent({ type: 'status', message: 'Busca cancelada' })
      return
    }

    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 })
    } catch {
      onEvent({
        type: 'error',
        message: 'Lista do Google Maps não apareceu. Tente de novo.',
      })
      return
    }

    // 1) Rola a barra até carregar bastante da lista
    const scrollTarget = Math.min(Math.max(limit + 20, 40), 180)
    onEvent({
      type: 'status',
      message: `Rolando a lista lateral até ~${scrollTarget} resultados…`,
    })
    const loaded = await scrollResultsFeed(page, scrollTarget, (msg) =>
      onEvent({ type: 'status', message: msg }),
    )

    if (isJobCancelled(jobId)) {
      onEvent({ type: 'status', message: 'Busca cancelada' })
      return
    }

    let articleCount = await page.locator('div[role="feed"] div[role="article"]').count()
    if (!articleCount) {
      onEvent({ type: 'error', message: 'Nenhum resultado na lista do Maps.' })
      return
    }

    onEvent({
      type: 'status',
      message: `${loaded || articleCount} na lista · capturando até ${limit}…`,
    })

    const seen = new Set<string>()
    let found = 0
    let i = 0
    const maxScan = Math.min(Math.max(articleCount, limit * 3), 250)

    while (found < limit && i < maxScan) {
      try {
        if (isJobCancelled(jobId)) {
          onEvent({ type: 'done', count: found })
          return
        }
        await waitIfPaused(jobId, () =>
          onEvent({ type: 'status', message: `Pausado · ${found}/${limit}` }),
        )

        // Garante que estamos na lista (não na página do lugar)
        const okList = await backToResultsList(page, base.url)
        if (!okList) {
          onEvent({ type: 'status', message: 'Reabrindo lista do Maps…' })
          continue
        }

        // Se a lista acabou, rola mais
        articleCount = await page.locator('div[role="feed"] div[role="article"]').count()
        if (i >= articleCount - 1 && found < limit) {
          await scrollResultsFeed(page, articleCount + 15, (msg) =>
            onEvent({ type: 'status', message: msg }),
          )
          articleCount = await page.locator('div[role="feed"] div[role="article"]').count()
          if (i >= articleCount) break
        }

        const articles = page.locator('div[role="feed"] div[role="article"]')
        const article = articles.nth(i)
        i += 1
        if (!(await article.count())) continue

        const listLabel = (await article.getAttribute('aria-label'))?.trim() || ''
        if (/^patrocinado\b/i.test(listLabel) || /^sponsored\b/i.test(listLabel)) continue

        let listName = listLabel.split(',')[0]?.trim() || ''
        if (isBadName(listName)) {
          const inner = article.locator('.fontHeadlineSmall, .qBF1Pd').first()
          if (await inner.count()) {
            listName = ((await inner.textContent()) || '').trim()
          }
        }
        if (isBadName(listName)) continue
        if (seen.has(listName.toLowerCase())) continue

        const listPhone = cleanPhone(listLabel)

        await article.scrollIntoViewIfNeeded()
        await page.waitForTimeout(150)
        await article.click({ timeout: 4000 })

        try {
          await page.waitForFunction(
            (expected) => {
              const h1 = document.querySelector('div[role="main"] h1')
              const t = h1?.textContent?.trim() || ''
              if (!t || /patrocinado|resultados/i.test(t)) return false
              if (!expected) return t.length > 1
              return (
                t.toLowerCase().includes(expected.slice(0, 8).toLowerCase()) || t.length > 2
              )
            },
            listName,
            { timeout: 2500 },
          )
        } catch {
          await page.waitForTimeout(500)
        }

        const panel = await extractPanelFast(page, listName)

        // Volta para a lista ANTES de processar o próximo (evita perder o feed)
        await backToResultsList(page, base.url)

        if (!panel || isBadName(panel.name)) continue

        const phone = panel.phone || listPhone
        const email = panel.email
        if (withContact && !phone && !email) continue

        const key = panel.name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        found += 1

        const place: PlaceResult = {
          place_id: `gmaps_${found}_${panel.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '_')
            .slice(0, 28)}`,
          name: panel.name,
          category: input.category,
          city: input.city,
          state: input.state || '',
          website: panel.website,
          address: panel.address || `${input.city}/${input.state || ''}`,
          rating: panel.rating,
          review_count: panel.reviewCount,
          phone,
          email,
          lat: panel.lat,
          lng: panel.lng,
        }

        if (found === 1 || found % 5 === 0) {
          const live = buildGoogleMapsUrls({
            ...input,
            placeName: place.name,
            lat: place.lat ?? undefined,
            lng: place.lng ?? undefined,
            zoom: 15,
          })
          onEvent({ type: 'maps_url', url: live.url, embedUrl: live.embedUrl })
        }

        onEvent({ type: 'place', place, index: found, totalHint: limit })
        onEvent({
          type: 'status',
          message: `${found}/${limit} · ${place.name}${phone ? ` · ${phone}` : ''}`,
        })
      } catch {
        // tenta recuperar a lista e segue
        try {
          if (page) await backToResultsList(page, base.url)
        } catch {
          // ignore
        }
      }
    }

    if (!found) {
      onEvent({
        type: 'error',
        message: withContact
          ? 'Nenhum telefone encontrado na lista. Amplie a busca ou desmarque o filtro de contato.'
          : 'Nenhum resultado extraído do Google Maps.',
      })
      return
    }

    onEvent({ type: 'done', count: found })
  } catch (err) {
    onEvent({
      type: 'error',
      message:
        err instanceof Error
          ? `Falha no Google Maps: ${err.message}`
          : 'Falha ao extrair do Google Maps',
    })
  } finally {
    try {
      await page?.close()
    } catch {
      // ignore
    }
  }
}
