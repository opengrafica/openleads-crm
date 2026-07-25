import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, MessageCircle, Phone, Trash2 } from 'lucide-react'
import { useLeads } from '@/hooks/useLeads'
import { deleteLead, updateLead } from '@/services/leadsService'
import { exportLeadsCSV, exportLeadsXLSX } from '@/services/exportService'
import type { LeadStatus } from '@/types'
import { CATEGORY_LABELS, LEAD_CATEGORIES, STATUS_LABELS } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select, Textarea } from '@/components/ui/Input'
import { Badge, Card } from '@/components/ui/Card'
import { cn, formatDate } from '@/lib/utils'
import { createManualContact, saveWhatsAppSelection } from '@/lib/whatsappSelection'

const statusTone: Record<LeadStatus, 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = {
  novo: 'accent',
  contatado: 'neutral',
  interessado: 'warning',
  cliente: 'success',
  perdido: 'danger',
}

export function CrmPage() {
  const navigate = useNavigate()
  const { leads, loading, refresh } = useLeads()
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCity, setFilterCity] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<LeadStatus>('novo')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterCategory !== 'all' && l.category !== filterCategory) return false
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterCity && !l.city.toLowerCase().includes(filterCity.toLowerCase())) return false
      return true
    })
  }, [leads, filterCategory, filterStatus, filterCity])

  const selected = useMemo(
    () => filtered.find((l) => l.id === selectedId) ?? leads.find((l) => l.id === selectedId) ?? null,
    [filtered, leads, selectedId],
  )

  useEffect(() => {
    const fromUrl = params.get('lead')
    if (fromUrl) setSelectedId(fromUrl)
  }, [params])

  useEffect(() => {
    if (!selected) return
    setNotes(selected.notes ?? '')
    setStatus(selected.status)
  }, [selected])

  async function saveSelected() {
    if (!selected) return
    setSaving(true)
    try {
      await updateLead(selected.id, { notes, status })
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function removeSelected() {
    if (!selected) return
    if (!confirm(`Excluir "${selected.name}"?`)) return
    await deleteLead(selected.id)
    setSelectedId(null)
    await refresh()
  }

  function sendToWhatsApp() {
    if (!selected?.phone) return
    saveWhatsAppSelection([
      createManualContact({
        name: selected.name,
        phone: selected.phone,
        address: selected.address,
        city: selected.city,
        state: selected.state,
      }),
    ])
    navigate('/app/whatsapp')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Leads</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Contatos salvos · status e observações
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportLeadsCSV(filtered)}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportLeadsXLSX(filtered)}>
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">Todas categorias</option>
            {LEAD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Todos status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Input
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            placeholder="Filtrar cidade"
          />
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Mobile: cards */}
        <div className="space-y-2 lg:hidden">
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nenhum lead. Salve contatos na Busca.</p>
          ) : (
            filtered.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelectedId(lead.id)}
                className={cn(
                  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-left',
                  selectedId === lead.id && 'ring-2 ring-[var(--accent)]',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{lead.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {lead.city}/{lead.state} · {CATEGORY_LABELS[lead.category]}
                    </p>
                    {lead.phone ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--accent)]">
                        <Phone className="h-3 w-3" />
                        {lead.phone}
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={statusTone[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Desktop: tabela */}
        <Card className="hidden overflow-hidden p-0 lg:block">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2.5">Nome</th>
                  <th className="px-3 py-2.5">Telefone</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-5 text-[var(--text-muted)]">
                      Carregando…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-5 text-[var(--text-muted)]">
                      Nenhum lead. Salve contatos na Busca.
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      className={cn(
                        'cursor-pointer border-b border-[var(--border)] hover:bg-[var(--bg-muted)]',
                        selectedId === lead.id && 'bg-[var(--accent-soft)]',
                      )}
                      onClick={() => setSelectedId(lead.id)}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-semibold">{lead.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {CATEGORY_LABELS[lead.category]} · {lead.city}/{lead.state}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">{lead.phone || '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={statusTone[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)]">
                        {formatDate(lead.updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-3 p-3 sm:p-4">
          {selected ? (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold">{selected.name}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {[selected.address, `${selected.city}/${selected.state}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {selected.phone ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{selected.phone}</p>
                ) : null}
                {selected.email ? (
                  <p className="text-sm text-[var(--text-muted)]">{selected.email}</p>
                ) : null}
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void saveSelected()} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
                {selected.phone ? (
                  <Button size="sm" variant="secondary" onClick={sendToWhatsApp}>
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                ) : null}
                <Button size="sm" variant="danger" onClick={() => void removeSelected()}>
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Toque em um lead para editar status e anotações.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
