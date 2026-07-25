import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import * as XLSX from 'xlsx'
import {
  MessageCircle,
  QrCode,
  Loader2,
  Pause,
  Play,
  Square,
  LogOut,
  Send,
  UserPlus,
  Upload,
  Trash2,
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label, Textarea } from '@/components/ui/Input'
import {
  cancelWhatsAppBulk,
  connectWhatsApp,
  getWhatsAppStatus,
  logoutWhatsApp,
  pauseWhatsAppBulk,
  resumeWhatsAppBulk,
  startWhatsAppBulk,
  validateWhatsAppPhones,
  type WaStatusResponse,
} from '@/services/whatsappService'
import {
  clearWhatsAppSelection,
  contactsFromSheetRows,
  createManualContact,
  loadWhatsAppSelection,
  mergeContacts,
  saveWhatsAppSelection,
  toWhatsAppJidDigits,
} from '@/lib/whatsappSelection'
import type { BusinessResult } from '@/types'

type WaFlag = 'unknown' | 'ok' | 'no' | 'invalid'

type WaContact = BusinessResult & { waFlag?: WaFlag }

const DEFAULT_MSGS = [
  'Olá {{nome}}! Tudo bem? Gostaria de apresentar uma solução rápida para captura de clientes.',
  'Oi {{nome}}, tudo certo? Vi o contato em {{endereco}} e queria saber se posso te enviar algo em 2 minutos.',
  'Bom dia {{nome}}! Posso te enviar um material curto sobre prospecção local?',
]

function flagOf(c: WaContact): WaFlag {
  if (c.waFlag) return c.waFlag
  return toWhatsAppJidDigits(c.phone) ? 'unknown' : 'invalid'
}

export function WhatsAppPage() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [status, setStatus] = useState<WaStatusResponse | null>(null)
  const [contacts, setContacts] = useState<WaContact[]>([])
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [msg1, setMsg1] = useState(DEFAULT_MSGS[0])
  const [msg2, setMsg2] = useState(DEFAULT_MSGS[1])
  const [msg3, setMsg3] = useState(DEFAULT_MSGS[2])
  const [delayMin, setDelayMin] = useState(15)
  const [delayMax, setDelayMax] = useState(35)
  const [busy, setBusy] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const counts = useMemo(() => {
    let ok = 0
    let no = 0
    let unknown = 0
    let invalid = 0
    for (const c of contacts) {
      const f = flagOf(c)
      if (f === 'ok') ok += 1
      else if (f === 'no') no += 1
      else if (f === 'invalid') invalid += 1
      else unknown += 1
    }
    return { ok, no, unknown, invalid, total: contacts.length }
  }, [contacts])

  const sendable = useMemo(
    () =>
      contacts
        .filter((c) => flagOf(c) === 'ok')
        .map((c) => ({
          ...c,
          wa: toWhatsAppJidDigits(c.phone)!,
        })),
    [contacts],
  )

  function persist(next: WaContact[]) {
    setContacts(next)
    saveWhatsAppSelection(next)
  }

  async function refresh() {
    try {
      setStatus(await getWhatsAppStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ler status')
    }
  }

  useEffect(() => {
    const loaded = loadWhatsAppSelection() as WaContact[]
    setContacts(
      loaded.map((c) => ({
        ...c,
        waFlag: c.waFlag || (toWhatsAppJidDigits(c.phone) ? 'unknown' : 'invalid'),
      })),
    )
    void refresh()
    const t = setInterval(() => void refresh(), 2000)
    return () => clearInterval(t)
  }, [])

  async function onConnect() {
    setBusy(true)
    setError(null)
    try {
      await connectWhatsApp()
      setInfo('Escaneie o QR com o WhatsApp do celular.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao conectar')
    } finally {
      setBusy(false)
    }
  }

  function onAddManual(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!toWhatsAppJidDigits(manualPhone)) {
      setError('Telefone inválido. Ex: 21999887766')
      return
    }
    const contact: WaContact = {
      ...createManualContact({
        name: manualName || 'Teste',
        phone: manualPhone,
        address: manualAddress,
      }),
      waFlag: 'unknown',
    }
    persist(mergeContacts(contacts, [contact]) as WaContact[])
    setManualName('')
    setManualPhone('')
    setManualAddress('')
    setInfo(`Adicionado: ${contact.name}`)
  }

  async function onImportFile(file: File) {
    setError(null)
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = book.Sheets[book.SheetNames[0]]
      if (!sheet) throw new Error('Planilha vazia')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const imported = contactsFromSheetRows(rows).map((c) => ({
        ...c,
        waFlag: 'unknown' as WaFlag,
      }))
      if (!imported.length) throw new Error('Nenhum telefone válido (use Nome + Telefone).')
      persist(mergeContacts(contacts, imported) as WaContact[])
      setInfo(`${imported.length} importado(s) · valide o WhatsApp antes de disparar`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao importar')
    }
  }

  async function onValidate() {
    setValidating(true)
    setError(null)
    setInfo(null)
    try {
      if (status?.status !== 'ready') {
        throw new Error('Conecte o WhatsApp antes de validar')
      }
      const withPhone = contacts.filter((c) => toWhatsAppJidDigits(c.phone))
      if (!withPhone.length) throw new Error('Nenhum telefone para validar')

      const res = await validateWhatsAppPhones(
        withPhone.map((c) => toWhatsAppJidDigits(c.phone)!),
      )
      const byDigits = new Map(
        res.results.filter((r) => r.digits).map((r) => [r.digits!, r.exists === true]),
      )

      const next = contacts.map((c) => {
        const digits = toWhatsAppJidDigits(c.phone)
        if (!digits) return { ...c, waFlag: 'invalid' as WaFlag }
        const exists = byDigits.get(digits)
        return {
          ...c,
          waFlag: (exists ? 'ok' : 'no') as WaFlag,
        }
      })
      persist(next)
      setInfo(`Validado · ${res.ok} com WhatsApp · ${res.no} sem WhatsApp`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na validação')
    } finally {
      setValidating(false)
    }
  }

  async function onStart() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (!sendable.length) {
        throw new Error('Valide os contatos e use só os com WhatsApp OK')
      }
      if (delayMin < 8) throw new Error('Intervalo mínimo: 8s')
      await startWhatsAppBulk({
        contacts: sendable.map((c) => ({
          phone: c.wa,
          name: c.name,
          address: c.address,
        })),
        messages: [msg1, msg2, msg3],
        delayMinSec: delayMin,
        delayMaxSec: delayMax,
        onlyValidated: true,
      })
      setInfo(`Disparo iniciado · ${sendable.length} número(s) com WhatsApp`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no disparo')
    } finally {
      setBusy(false)
    }
  }

  const wa = status?.status || 'disconnected'
  const bulk = status?.bulk
  const running = Boolean(bulk?.running)

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">WhatsApp</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Valide números reais, dispare com intervalo e pause/cancele quando quiser.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold">Conexão</h2>
            </div>
            <span className="text-xs font-semibold text-[var(--accent)]">
              {wa === 'ready'
                ? 'Conectado'
                : wa === 'qr'
                  ? 'QR pronto'
                  : wa === 'connecting'
                    ? 'Conectando…'
                    : 'Desconectado'}
            </span>
          </div>

          {status?.qr ? (
            <img
              src={status.qr}
              alt="QR WhatsApp"
              className="mx-auto max-h-44 rounded-lg border border-[var(--border)] bg-white p-1.5"
            />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)]">
              {wa === 'ready' ? 'Sessão ativa' : 'Toque em Conectar para gerar o QR'}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void onConnect()} disabled={busy || wa === 'ready'}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              Conectar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void logoutWhatsApp().then(refresh)}
              disabled={wa === 'disconnected'}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Contatos · {counts.ok} WA · {counts.total} total
            </h2>
            {contacts.length ? (
              <button
                type="button"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                onClick={() => {
                  clearWhatsAppSelection()
                  setContacts([])
                }}
              >
                <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                Limpar
              </button>
            ) : null}
          </div>

          <p className="text-[11px] text-[var(--text-muted)]">
            {counts.ok} com WhatsApp · {counts.no} sem · {counts.unknown} pendente
            {counts.invalid ? ` · ${counts.invalid} inválido` : ''}
          </p>

          <form className="grid grid-cols-2 gap-2" onSubmit={onAddManual}>
            <Input
              placeholder="Nome"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
            <Input
              placeholder="Telefone"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              required
            />
            <Input
              className="col-span-2"
              placeholder="Endereço (opcional)"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
            />
            <Button type="submit" size="sm">
              <UserPlus className="h-4 w-4" />
              Adicionar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImportFile(f)
                e.target.value = ''
              }}
            />
          </form>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => void onValidate()}
            disabled={validating || wa !== 'ready' || !contacts.length || running}
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Validar WhatsApp
          </Button>

          <div className="max-h-44 space-y-1.5 overflow-y-auto">
            {contacts.map((c) => {
              const f = flagOf(c)
              return (
                <div
                  key={c.place_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{c.phone}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      f === 'ok'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : f === 'no'
                          ? 'bg-red-500/15 text-red-400'
                          : f === 'invalid'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-white/5 text-[var(--text-muted)]'
                    }`}
                    title={
                      f === 'ok'
                        ? 'WhatsApp ativo'
                        : f === 'no'
                          ? 'Sem WhatsApp'
                          : f === 'invalid'
                            ? 'Telefone inválido'
                            : 'Ainda não validado'
                    }
                  >
                    {f === 'ok' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : f === 'no' || f === 'invalid' ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <HelpCircle className="h-3 w-3" />
                    )}
                    {f === 'ok' ? 'WA OK' : f === 'no' ? 'Sem WA' : f === 'invalid' ? 'Inválido' : '?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => persist(contacts.filter((x) => x.place_id !== c.place_id))}
                  >
                    <X className="h-4 w-4 text-[var(--text-muted)]" />
                  </button>
                </div>
              )
            })}
            {!contacts.length ? (
              <p className="text-xs text-[var(--text-muted)]">
                Adicione, importe ou envie da Busca. Depois valide o WhatsApp.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="space-y-3 p-3 sm:p-4">
        <div>
          <h2 className="text-sm font-semibold">Mensagens intercaladas</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {'{{nome}}'}, {'{{endereco}}'}, {'{{telefone}}'} · ordem A→B→C→A… · só números com WA OK
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label>A</Label>
            <Textarea rows={2} value={msg1} onChange={(e) => setMsg1(e.target.value)} />
          </div>
          <div>
            <Label>B</Label>
            <Textarea rows={2} value={msg2} onChange={(e) => setMsg2(e.target.value)} />
          </div>
          <div>
            <Label>C</Label>
            <Textarea rows={2} value={msg3} onChange={(e) => setMsg3(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <div>
            <Label>Intervalo min (s)</Label>
            <Input
              type="number"
              min={8}
              value={delayMin}
              onChange={(e) => setDelayMin(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Intervalo max (s)</Label>
            <Input
              type="number"
              min={8}
              value={delayMax}
              onChange={(e) => setDelayMax(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void onStart()}
            disabled={busy || wa !== 'ready' || running || !sendable.length}
          >
            <Send className="h-4 w-4" />
            Disparar ({sendable.length})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void pauseWhatsAppBulk().then(refresh)}
            disabled={!running || Boolean(bulk?.paused)}
          >
            <Pause className="h-4 w-4" /> Pausar
          </Button>
          <Button
            size="sm"
            onClick={() => void resumeWhatsAppBulk().then(refresh)}
            disabled={!running || !bulk?.paused}
          >
            <Play className="h-4 w-4" /> Continuar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void cancelWhatsAppBulk().then(refresh)}
            disabled={!running}
          >
            <Square className="h-4 w-4" /> Cancelar
          </Button>
        </div>

        {bulk?.total ? (
          <p className="text-xs text-[var(--accent)]">
            {bulk.sent}/{bulk.total}
            {bulk.failed ? ` · falhas ${bulk.failed}` : ''}
            {bulk.current ? ` · ${bulk.current}` : ''}
            {bulk.paused ? ' · PAUSADO' : ''}
            {running ? ' · em andamento' : bulk.cancelled ? ' · cancelado' : ' · finalizado'}
          </p>
        ) : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {info ? <p className="text-sm text-[var(--accent)]">{info}</p> : null}
        {bulk?.logs?.length ? (
          <div className="max-h-28 overflow-y-auto rounded-lg bg-[var(--bg-muted)] p-2 text-[11px] text-[var(--text-muted)]">
            {bulk.logs.slice(0, 12).map((line, i) => (
              <p key={`${i}-${line}`}>{line}</p>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
