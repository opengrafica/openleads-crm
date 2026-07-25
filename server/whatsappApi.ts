import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import qrcode from 'qrcode'
import pino from 'pino'

type WaStatus = 'disconnected' | 'qr' | 'connecting' | 'ready'

type BulkItem = {
  phone: string
  name?: string
  address?: string
}

type BulkState = {
  running: boolean
  paused: boolean
  cancelled: boolean
  sent: number
  failed: number
  total: number
  current?: string
  logs: string[]
}

let sock: any = null
let waStatus: WaStatus = 'disconnected'
let lastQrDataUrl: string | null = null
let authDir = process.env.VERCEL
  ? '/tmp/openleads-wa-auth'
  : path.resolve(process.cwd(), '.wa-auth')

const bulk: BulkState = {
  running: false,
  paused: false,
  cancelled: false,
  sent: 0,
  failed: 0,
  total: 0,
  logs: [],
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function pushLog(msg: string) {
  bulk.logs.unshift(`${new Date().toLocaleTimeString('pt-BR')} · ${msg}`)
  if (bulk.logs.length > 80) bulk.logs.length = 80
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function toJid(phone: string): string | null {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }
  if (digits.length < 12) return null
  return `${digits}@s.whatsapp.net`
}

function applyTemplate(tpl: string, item: BulkItem) {
  return tpl
    .replace(/\{\{\s*nome\s*\}\}/gi, item.name || '')
    .replace(/\{\{\s*endereco\s*\}\}/gi, item.address || '')
    .replace(/\{\{\s*telefone\s*\}\}/gi, item.phone || '')
}

async function ensureSocket() {
  if (sock && waStatus === 'ready') return sock

  const baileys = await import('@whiskeysockets/baileys')
  const makeWASocket = baileys.default || (baileys as any).makeWASocket
  const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys as any

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(authDir)

  const safeSaveCreds = async () => {
    try {
      if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
      await saveCreds()
    } catch {
      // não derruba o servidor se a pasta sumir no logout
    }
  }

  let version: [number, number, number] | undefined
  try {
    const v = await fetchLatestBaileysVersion()
    version = v.version as [number, number, number]
  } catch {
    // usa default
  }

  waStatus = 'connecting'
  lastQrDataUrl = null

  sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  })

  sock.ev.on('creds.update', () => {
    void safeSaveCreds()
  })

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      waStatus = 'qr'
      lastQrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 280 })
    }
    if (connection === 'open') {
      waStatus = 'ready'
      lastQrDataUrl = null
      pushLog('WhatsApp conectado')
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason?.loggedOut
      waStatus = 'disconnected'
      sock = null
      if (shouldReconnect) {
        pushLog('Reconectando WhatsApp...')
        setTimeout(() => {
          void ensureSocket().catch(() => undefined)
        }, 2000)
      } else {
        pushLog('Desconectado (logout). Escaneie o QR novamente.')
        try {
          fs.rmSync(authDir, { recursive: true, force: true })
        } catch {
          // ignore
        }
        try {
          fs.mkdirSync(authDir, { recursive: true })
        } catch {
          // ignore
        }
      }
    }
  })

  return sock
}

type ValidateResult = {
  phone: string
  digits: string | null
  exists: boolean | null
  jid: string | null
}

/** Confirma quais números existem no WhatsApp (Baileys onWhatsApp). */
async function validatePhones(phones: string[]): Promise<ValidateResult[]> {
  if (waStatus !== 'ready' || !sock) {
    throw new Error('Conecte o WhatsApp antes de validar os números')
  }

  const unique: { original: string; digits: string; jid: string }[] = []
  const seen = new Set<string>()
  for (const phone of phones) {
    const jid = toJid(phone)
    if (!jid) {
      unique.push({ original: phone, digits: '', jid: '' })
      continue
    }
    const digits = jid.replace(/@s\.whatsapp\.net$/, '')
    if (seen.has(digits)) continue
    seen.add(digits)
    unique.push({ original: phone, digits, jid })
  }

  const existsMap = new Map<string, { exists: boolean; jid: string }>()
  const valid = unique.filter((u) => u.digits)
  const chunkSize = 20

  for (let i = 0; i < valid.length; i += chunkSize) {
    const chunk = valid.slice(i, i + chunkSize)
    try {
      const res = (await sock.onWhatsApp(...chunk.map((c) => c.digits))) as
        | { jid: string; exists: boolean }[]
        | undefined
      for (const row of res || []) {
        const digits = (row.jid || '').replace(/@s\.whatsapp\.net$/i, '').split(':')[0]
        if (digits) {
          existsMap.set(digits, { exists: Boolean(row.exists), jid: row.jid })
        }
      }
      // números não retornados = sem WhatsApp
      for (const c of chunk) {
        if (!existsMap.has(c.digits)) {
          existsMap.set(c.digits, { exists: false, jid: c.jid })
        }
      }
    } catch (err) {
      pushLog(
        `Validação falhou no lote: ${err instanceof Error ? err.message : 'erro'}`,
      )
      for (const c of chunk) {
        if (!existsMap.has(c.digits)) {
          existsMap.set(c.digits, { exists: false, jid: c.jid })
        }
      }
    }
    if (i + chunkSize < valid.length) await sleep(350)
  }

  return unique.map((u) => {
    if (!u.digits) {
      return { phone: u.original, digits: null, exists: false, jid: null }
    }
    const hit = existsMap.get(u.digits)
    return {
      phone: u.original,
      digits: u.digits,
      exists: hit?.exists ?? false,
      jid: hit?.exists ? hit.jid : null,
    }
  })
}

async function runBulk(input: {
  contacts: BulkItem[]
  messages: string[]
  delayMinSec: number
  delayMaxSec: number
  onlyValidated?: boolean
}) {
  if (bulk.running) throw new Error('Já existe um disparo em andamento')
  if (waStatus !== 'ready' || !sock) throw new Error('Conecte o WhatsApp antes de disparar')

  const messages = input.messages.map((m) => m.trim()).filter(Boolean)
  if (!messages.length) throw new Error('Informe ao menos uma mensagem')
  if (!input.contacts.length) throw new Error('Nenhum contato para disparar')

  const delayMin = Math.max(5, Math.floor(input.delayMinSec || 12))
  const delayMax = Math.max(delayMin, Math.floor(input.delayMaxSec || 25))

  bulk.running = true
  bulk.paused = false
  bulk.cancelled = false
  bulk.sent = 0
  bulk.failed = 0
  bulk.total = input.contacts.length
  bulk.current = undefined
  pushLog(`Iniciando disparo · ${bulk.total} contato(s) · intervalo ${delayMin}-${delayMax}s`)

  void (async () => {
    try {
      for (let i = 0; i < input.contacts.length; i++) {
        while (bulk.paused && !bulk.cancelled) {
          await sleep(400)
        }
        if (bulk.cancelled) {
          pushLog('Disparo cancelado')
          break
        }

        const item = input.contacts[i]
        const jid = toJid(item.phone)
        bulk.current = item.name || item.phone

        if (!jid) {
          bulk.failed += 1
          pushLog(`Falha · telefone inválido: ${item.phone}`)
          continue
        }

        // Reconfirma no momento do envio se pedido
        if (input.onlyValidated) {
          try {
            const check = (await sock.onWhatsApp(jid.replace('@s.whatsapp.net', ''))) as
              | { jid: string; exists: boolean }[]
              | undefined
            const ok = check?.some((r) => r.exists)
            if (!ok) {
              bulk.failed += 1
              pushLog(`Sem WhatsApp · ${bulk.current}`)
              continue
            }
          } catch {
            // segue tentativa de envio
          }
        }

        const tpl = messages[i % messages.length]
        const text = applyTemplate(tpl, item)

        try {
          await sock.sendMessage(jid, { text })
          bulk.sent += 1
          pushLog(`Enviado · ${bulk.current}`)
        } catch (err) {
          bulk.failed += 1
          pushLog(
            `Erro · ${bulk.current}: ${err instanceof Error ? err.message : 'falha ao enviar'}`,
          )
        }

        if (i < input.contacts.length - 1 && !bulk.cancelled) {
          const waitSec =
            delayMin + Math.floor(Math.random() * (delayMax - delayMin + 1))
          pushLog(`Aguardando ${waitSec}s (anti-bloqueio)...`)
          const end = Date.now() + waitSec * 1000
          while (Date.now() < end) {
            if (bulk.cancelled) break
            while (bulk.paused && !bulk.cancelled) await sleep(400)
            await sleep(300)
          }
        }
      }
      if (!bulk.cancelled) {
        pushLog(`Concluído · ${bulk.sent} ok · ${bulk.failed} falha(s)`)
      }
    } finally {
      bulk.running = false
      bulk.paused = false
      bulk.current = undefined
    }
  })()
}

export function whatsappApiPlugin(): Plugin {
  return {
    name: 'openleads-whatsapp-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleWhatsAppApi(req, res, next)
      })
    },
  }
}

/** Middleware Connect/Vite/Vercel para /api/whatsapp/* */
export async function handleWhatsAppApi(
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
) {
  if (!req.url?.startsWith('/api/whatsapp')) {
    next?.()
    return
  }

        try {
          const url = new URL(req.url, 'http://localhost')
          const pathname = url.pathname

          if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
            return sendJson(res, 200, {
              status: waStatus,
              qr: lastQrDataUrl,
              bulk: {
                running: bulk.running,
                paused: bulk.paused,
                cancelled: bulk.cancelled,
                sent: bulk.sent,
                failed: bulk.failed,
                total: bulk.total,
                current: bulk.current,
                logs: bulk.logs.slice(0, 25),
              },
            })
          }

          if (pathname === '/api/whatsapp/validate' && req.method === 'POST') {
            const raw = await readBody(req)
            const body = JSON.parse(raw || '{}') as { phones?: string[] }
            const phones = Array.isArray(body.phones) ? body.phones : []
            if (!phones.length) {
              return sendJson(res, 400, { error: 'Informe phones[]' })
            }
            const results = await validatePhones(phones.slice(0, 300))
            const ok = results.filter((r) => r.exists).length
            const no = results.filter((r) => r.exists === false).length
            pushLog(`Validação · ${ok} com WhatsApp · ${no} sem`)
            return sendJson(res, 200, { results, ok, no, total: results.length })
          }

          if (pathname === '/api/whatsapp/connect' && req.method === 'POST') {
            await ensureSocket()
            return sendJson(res, 200, { status: waStatus, qr: lastQrDataUrl })
          }

          if (pathname === '/api/whatsapp/logout' && req.method === 'POST') {
            try {
              await sock?.logout?.()
            } catch {
              // ignore
            }
            sock = null
            waStatus = 'disconnected'
            lastQrDataUrl = null
            try {
              fs.rmSync(authDir, { recursive: true, force: true })
            } catch {
              // ignore
            }
            try {
              fs.mkdirSync(authDir, { recursive: true })
            } catch {
              // ignore
            }
            return sendJson(res, 200, { ok: true })
          }

          if (pathname === '/api/whatsapp/bulk/start' && req.method === 'POST') {
            const raw = await readBody(req)
            const body = JSON.parse(raw || '{}') as {
              contacts?: BulkItem[]
              messages?: string[]
              delayMinSec?: number
              delayMaxSec?: number
              onlyValidated?: boolean
            }
            await runBulk({
              contacts: body.contacts || [],
              messages: body.messages || [],
              delayMinSec: body.delayMinSec ?? 12,
              delayMaxSec: body.delayMaxSec ?? 25,
              onlyValidated: body.onlyValidated !== false,
            })
            return sendJson(res, 200, { ok: true })
          }

          if (pathname === '/api/whatsapp/bulk/pause' && req.method === 'POST') {
            bulk.paused = true
            pushLog('Disparo pausado')
            return sendJson(res, 200, { ok: true })
          }

          if (pathname === '/api/whatsapp/bulk/resume' && req.method === 'POST') {
            bulk.paused = false
            pushLog('Disparo retomado')
            return sendJson(res, 200, { ok: true })
          }

          if (pathname === '/api/whatsapp/bulk/cancel' && req.method === 'POST') {
            bulk.cancelled = true
            bulk.paused = false
            pushLog('Cancelando disparo...')
            return sendJson(res, 200, { ok: true })
          }

          return sendJson(res, 404, { error: 'Rota WhatsApp não encontrada' })
        } catch (err) {
          return sendJson(res, 500, {
            error: err instanceof Error ? err.message : 'Erro WhatsApp',
          })
        }
}
