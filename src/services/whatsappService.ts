export type WaConnectionStatus = 'disconnected' | 'qr' | 'connecting' | 'ready'

export interface WaBulkStatus {
  running: boolean
  paused: boolean
  cancelled?: boolean
  sent: number
  failed: number
  total: number
  current?: string
  logs: string[]
}

export interface WaStatusResponse {
  status: WaConnectionStatus
  qr: string | null
  bulk: WaBulkStatus
}

export interface WaValidateItem {
  phone: string
  digits: string | null
  exists: boolean | null
  jid: string | null
}

export interface WaValidateResponse {
  results: WaValidateItem[]
  ok: number
  no: number
  total: number
}

async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Erro na API WhatsApp')
  return data
}

export async function getWhatsAppStatus(): Promise<WaStatusResponse> {
  const res = await fetch('/api/whatsapp/status')
  if (!res.ok) throw new Error('Falha ao ler status do WhatsApp')
  return res.json()
}

export async function connectWhatsApp() {
  return post('/api/whatsapp/connect')
}

export async function logoutWhatsApp() {
  return post('/api/whatsapp/logout')
}

export async function validateWhatsAppPhones(phones: string[]): Promise<WaValidateResponse> {
  return post('/api/whatsapp/validate', { phones }) as Promise<WaValidateResponse>
}

export async function startWhatsAppBulk(input: {
  contacts: { phone: string; name?: string; address?: string }[]
  messages: string[]
  delayMinSec: number
  delayMaxSec: number
  onlyValidated?: boolean
}) {
  return post('/api/whatsapp/bulk/start', input)
}

export async function pauseWhatsAppBulk() {
  return post('/api/whatsapp/bulk/pause')
}

export async function resumeWhatsAppBulk() {
  return post('/api/whatsapp/bulk/resume')
}

export async function cancelWhatsAppBulk() {
  return post('/api/whatsapp/bulk/cancel')
}
