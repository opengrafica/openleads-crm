import type { BusinessResult, LeadCategory } from '@/types'

const KEY = 'openleads_wa_selected'

export type WaContactFlag = 'unknown' | 'ok' | 'no' | 'invalid'

export type WaStoredContact = BusinessResult & { waFlag?: WaContactFlag }

export function saveWhatsAppSelection(contacts: WaStoredContact[]) {
  sessionStorage.setItem(KEY, JSON.stringify(contacts))
}

export function loadWhatsAppSelection(): WaStoredContact[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WaStoredContact[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearWhatsAppSelection() {
  sessionStorage.removeItem(KEY)
}

/** Normaliza telefone BR para WhatsApp (somente dígitos com 55). */
export function toWhatsAppJidDigits(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12) return digits
  return null
}

export function createManualContact(input: {
  name: string
  phone: string
  address?: string
  city?: string
  state?: string
}): BusinessResult {
  const name = input.name.trim() || 'Contato'
  const phone = input.phone.trim()
  return {
    place_id: `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    category: 'outros' as LeadCategory,
    city: input.city?.trim() || '',
    state: input.state?.trim() || '',
    website: null,
    address: input.address?.trim() || '',
    rating: null,
    review_count: null,
    phone,
    email: null,
  }
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  const entries = Object.entries(row)
  for (const key of keys) {
    const found = entries.find(([k]) => k.trim().toLowerCase() === key)
    if (found && found[1] != null && String(found[1]).trim()) {
      return String(found[1]).trim()
    }
  }
  for (const key of keys) {
    const found = entries.find(([k]) => k.trim().toLowerCase().includes(key))
    if (found && found[1] != null && String(found[1]).trim()) {
      return String(found[1]).trim()
    }
  }
  return ''
}

/** Converte linhas de planilha (CSV/XLSX) em contatos. */
export function contactsFromSheetRows(rows: Record<string, unknown>[]): BusinessResult[] {
  const out: BusinessResult[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const name =
      pickField(row, ['nome', 'name', 'empresa', 'contato', 'cliente']) || 'Contato'
    const phone = pickField(row, [
      'telefone',
      'phone',
      'celular',
      'whatsapp',
      'fone',
      'tel',
      'mobile',
    ])
    if (!phone || !toWhatsAppJidDigits(phone)) continue

    const key = toWhatsAppJidDigits(phone)!
    if (seen.has(key)) continue
    seen.add(key)

    out.push(
      createManualContact({
        name,
        phone,
        address: pickField(row, ['endereco', 'endereço', 'address', 'rua']),
        city: pickField(row, ['cidade', 'city']),
        state: pickField(row, ['estado', 'uf', 'state']),
      }),
    )
  }

  return out
}

export function mergeContacts(
  current: WaStoredContact[],
  incoming: WaStoredContact[],
): WaStoredContact[] {
  const map = new Map<string, WaStoredContact>()
  for (const c of [...current, ...incoming]) {
    const key = toWhatsAppJidDigits(c.phone) || c.place_id
    const prev = map.get(key)
    map.set(key, {
      ...prev,
      ...c,
      waFlag: c.waFlag ?? prev?.waFlag ?? 'unknown',
    })
  }
  return [...map.values()]
}
