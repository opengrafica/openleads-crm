import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Star,
  Globe,
  Plus,
  Loader2,
  Phone,
  Mail,
  FileSpreadsheet,
  FileDown,
  Pause,
  Play,
  MessageCircle,
  CheckSquare,
  Square,
} from 'lucide-react'
import { controlSearchJob, searchBusinessesStream } from '@/services/searchService'
import { saveLeadFromBusiness } from '@/services/leadsService'
import {
  exportSearchResultsCSV,
  exportSearchResultsXLSX,
} from '@/services/exportService'
import { useAuth } from '@/hooks/useAuth'
import type { BusinessResult, LeadCategory } from '@/types'
import { CATEGORY_LABELS, LEAD_CATEGORIES } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { Card, Badge } from '@/components/ui/Card'
import { SearchMapPanel } from '@/components/SearchMapPanel'
import { cn } from '@/lib/utils'
import { saveWhatsAppSelection } from '@/lib/whatsappSelection'
import {
  appendCloudSearchResult,
  createCloudSearchJob,
  getCloudSearchJob,
  listCloudSearchJobs,
  loadCloudSearchResults,
  updateCloudSearchJob,
  type CloudSearchJob,
} from '@/services/cloudSearchService'

const CONTACT_LIMITS = [10, 20, 30, 50, 75, 100, 150, 200] as const

type FieldFlags = {
  name: boolean
  phone: boolean
  email: boolean
  address: boolean
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function filterFields(biz: BusinessResult, fields: FieldFlags): BusinessResult {
  return {
    ...biz,
    name: fields.name ? biz.name : biz.name,
    phone: fields.phone ? biz.phone : null,
    email: fields.email ? biz.email ?? null : null,
    address: fields.address ? biz.address : '',
    website: biz.website,
  }
}

export function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<LeadCategory>('pizzaria')
  const [city, setCity] = useState('São Paulo')
  const [state, setState] = useState('SP')
  const [cep, setCep] = useState('')
  const [limit, setLimit] = useState(30)
  const [radiusKm, setRadiusKm] = useState(5)
  const [withContact, setWithContact] = useState(true)
  const [fastMode, setFastMode] = useState(true)
  const [fields, setFields] = useState<FieldFlags>({
    name: true,
    phone: true,
    email: true,
    address: true,
  })
  const [results, setResults] = useState<BusinessResult[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<BusinessResult | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [mapQuery, setMapQuery] = useState('São Paulo, SP')
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [mapsUrl, setMapsUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [paused, setPaused] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [cloudJobs, setCloudJobs] = useState<CloudSearchJob[]>([])

  const canSearch = Boolean(cep.replace(/\D/g, '').length === 8 || city.trim())
  const marked = useMemo(
    () => results.filter((r) => checked.has(r.place_id)),
    [results, checked],
  )

  async function refreshCloudJobs() {
    if (!user?.id) return
    try {
      setCloudJobs(await listCloudSearchJobs(user.id))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshCloudJobs()
  }, [user?.id])

  useEffect(() => {
    return () => stopRef.current?.()
  }, [])

  async function openCloudJob(job: CloudSearchJob) {
    setJobId(job.id)
    setStatus(job.status_message || job.status)
    setLoading(job.status === 'running' || job.status === 'paused' || job.status === 'queued')
    setPaused(job.status === 'paused')
    setEmbedUrl(job.embed_url)
    setMapsUrl(job.maps_url)
    const places = await loadCloudSearchResults(job.id)
    setResults(places)
    setChecked(new Set(places.map((p) => p.place_id)))
    if (places[0]) setSelected(places[0])
    setMessage(
      job.status === 'completed'
        ? `Busca na nuvem · ${job.result_count} contato(s)`
        : job.status === 'failed'
          ? `Busca anterior com falha · ${job.result_count} contato(s) salvos. Você pode buscar de novo.`
          : `Busca na nuvem · ${job.result_count} contato(s) · ${job.status}`,
    )

    // Se ainda rodando, acompanha por polling
    if (job.status === 'running' || job.status === 'paused' || job.status === 'queued') {
      const timer = setInterval(() => {
        void (async () => {
          const latest = await getCloudSearchJob(job.id)
          if (!latest) return
          const rows = await loadCloudSearchResults(job.id)
          setResults(rows)
          setStatus(latest.status_message || latest.status)
          setLoading(
            latest.status === 'running' ||
              latest.status === 'paused' ||
              latest.status === 'queued',
          )
          setPaused(latest.status === 'paused')
          if (latest.status === 'completed' || latest.status === 'failed' || latest.status === 'cancelled') {
            clearInterval(timer)
            setMessage(`Busca finalizada · ${latest.result_count} contato(s)`)
            void refreshCloudJobs()
          }
        })()
      }, 2500)
      return () => clearInterval(timer)
    }
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (checked.size === results.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(results.map((r) => r.place_id)))
    }
  }

  function exportList(list: BusinessResult[], format: 'xlsx' | 'csv') {
    const rows = list.map((b) => filterFields(b, fields))
    const base = `openleads-${category}-${city || 'busca'}`
    if (format === 'xlsx') exportSearchResultsXLSX(rows, `${base}.xlsx`)
    else exportSearchResultsCSV(rows, `${base}.csv`)
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    if (!user?.id) {
      setError('Faça login para buscar na nuvem.')
      return
    }
    stopRef.current?.()

    setLoading(true)
    setPaused(false)
    setJobId(null)
    setMessage(null)
    setError(null)
    setSource(null)
    setResults([])
    setChecked(new Set())
    setSelected(null)
    setEmbedUrl(null)
    setMapsUrl(null)
    setStatus('Abrindo Google Maps...')

    const initialMap = [
      query.trim() || CATEGORY_LABELS[category],
      cep.trim() || [city.trim(), state.trim()].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' ')
    setMapQuery(initialMap)

    const newJobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    setJobId(newJobId)

    void createCloudSearchJob({
      id: newJobId,
      userId: user.id,
      params: {
        category,
        city,
        state,
        query,
        cep: cep || undefined,
        limit,
        radiusKm,
        withContact,
        fast: fastMode,
      },
    })
      .then(() => refreshCloudJobs())
      .catch(() => undefined)

    let captured = 0

    stopRef.current = searchBusinessesStream(
      {
        query,
        category,
        city,
        state,
        cep: cep || undefined,
        limit,
        radiusKm,
        withContact,
        wantEmail: fields.email && !fastMode,
        fast: fastMode,
        source: 'google',
        jobId: newJobId,
      },
      (event) => {
        if (event.type === 'job') setJobId(event.jobId)
        if (event.type === 'status') {
          setStatus(event.message)
          void updateCloudSearchJob(newJobId, { status_message: event.message, status: 'running' })
        }
        if (event.type === 'maps_url') {
          setEmbedUrl(event.embedUrl)
          setMapsUrl(event.url)
          void updateCloudSearchJob(newJobId, {
            maps_url: event.url,
            embed_url: event.embedUrl,
          })
        }
        if (event.type === 'geo') {
          setCity(event.city)
          setState(event.state.slice(0, 2).toUpperCase())
          setMapQuery(
            [query.trim() || CATEGORY_LABELS[category], event.city, event.state]
              .filter(Boolean)
              .join(' '),
          )
        }
        if (event.type === 'place') {
          const place = filterFields(event.place, fields)
          captured += 1
          setResults((prev) => [...prev, place])
          setChecked((prev) => new Set(prev).add(place.place_id))
          setSelected(place)
          setMapQuery(
            place.lat != null && place.lng != null
              ? `${place.name} @${place.lat},${place.lng}`
              : `${place.name} ${place.city} ${place.state}`,
          )
          setStatus(
            `Capturando ${event.index}/${event.totalHint}: ${place.name}${
              place.phone ? ` · ${place.phone}` : ''
            }${place.email ? ` · ${place.email}` : ''}`,
          )
          void appendCloudSearchResult({ jobId: newJobId, userId: user.id, place })
          void updateCloudSearchJob(newJobId, {
            result_count: captured,
            status_message: `${captured}/${limit} na nuvem`,
          })
          requestAnimationFrame(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
          })
        }
        if (event.type === 'done') {
          setLoading(false)
          setPaused(false)
          setSource(event.source)
          setStatus(`Concluído · ${event.count} contato(s)`)
          void updateCloudSearchJob(newJobId, {
            status: 'completed',
            result_count: event.count,
            status_message: `Concluído · ${event.count}`,
            completed_at: new Date().toISOString(),
          }).then(() => refreshCloudJobs())
          if (event.city) setCity(event.city)
          if (event.state) setState(event.state.slice(0, 2).toUpperCase())
          if (!event.count) {
            setMessage(
              withContact
                ? 'Nenhum contato nesse raio. Aumente a quantidade ou o km.'
                : 'Nenhum resultado. Tente outra categoria, CEP ou cidade.',
            )
          } else {
            setMessage('Resultados salvos na nuvem — você pode sair e voltar depois.')
          }
        }
        if (event.type === 'disconnected') {
          setLoading(false)
          setPaused(false)
          setError(null)
          setMessage(event.message)
          void (async () => {
            const rows = await loadCloudSearchResults(newJobId)
            const count = Math.max(rows.length, captured)
            if (rows.length) {
              setResults(rows)
              setChecked(new Set(rows.map((r) => r.place_id)))
            }
            if (count > 0) {
              await updateCloudSearchJob(newJobId, {
                status: 'completed',
                result_count: count,
                status_message: `Salvo na nuvem · ${count}`,
                completed_at: new Date().toISOString(),
              })
            } else {
              await updateCloudSearchJob(newJobId, {
                status: 'cancelled',
                status_message: event.message,
                completed_at: new Date().toISOString(),
              })
            }
            void refreshCloudJobs()
          })()
        }
        if (event.type === 'error') {
          setLoading(false)
          setPaused(false)
          setError(event.message)
          void updateCloudSearchJob(newJobId, {
            status: captured > 0 ? 'completed' : 'failed',
            result_count: captured,
            status_message:
              captured > 0
                ? `Salvo na nuvem · ${captured} (conexão encerrada)`
                : event.message,
            completed_at: new Date().toISOString(),
          }).then(() => refreshCloudJobs())
        }
      },
    )
  }

  async function pauseSearch() {
    if (!jobId) return
    await controlSearchJob(jobId, 'pause')
    setPaused(true)
    setStatus((s) => s || 'Pausado')
    void updateCloudSearchJob(jobId, { status: 'paused', status_message: 'Pausado' })
  }

  async function resumeSearch() {
    if (!jobId) return
    await controlSearchJob(jobId, 'resume')
    setPaused(false)
    setStatus('Continuando busca...')
    void updateCloudSearchJob(jobId, { status: 'running', status_message: 'Continuando…' })
  }

  async function cancelSearch() {
    if (jobId) {
      await controlSearchJob(jobId, 'cancel').catch(() => undefined)
    }
    stopRef.current?.()
    setLoading(false)
    setPaused(false)
    setStatus(`Cancelado · ${results.length} contato(s) mantidos`)
  }

  async function saveLead(business: BusinessResult) {
    if (!user) return
    setSavingId(business.place_id)
    setMessage(null)
    try {
      await saveLeadFromBusiness(user.id, business)
      setMessage(`Lead salvo: ${business.name}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao salvar lead')
    } finally {
      setSavingId(null)
    }
  }

  function sendMarkedToWhatsApp() {
    const list = marked.length ? marked : results
    const withPhone = list.filter((c) => c.phone)
    if (!withPhone.length) {
      setMessage('Marque contatos com telefone para disparar no WhatsApp.')
      return
    }
    saveWhatsAppSelection(withPhone)
    navigate('/app/whatsapp')
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Busca</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Captura rápida em escala · pausar/continuar · marcar · exportar ou WhatsApp
        </p>
      </div>

      <Card className="p-3 sm:p-4">
        <form className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" onSubmit={onSearch}>
          <div className="sm:col-span-2 xl:col-span-2">
            <Label htmlFor="q">Termo</Label>
            <Input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="pizza, burger…"
            />
          </div>
          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LeadCategory)}
            >
              {LEAD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              placeholder="Só se for da mesma cidade"
              inputMode="numeric"
            />
          </div>
          <div>
            <Label htmlFor="city">Cidade {cep.replace(/\D/g, '').length === 8 ? '' : '*'}</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="São Gonçalo"
              required={cep.replace(/\D/g, '').length !== 8}
            />
          </div>
          <div>
            <Label htmlFor="state">UF</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="SP"
              maxLength={2}
            />
          </div>
          <div>
            <Label htmlFor="limit">Qtd.</Label>
            <Select
              id="limit"
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {CONTACT_LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="radiusKm">Raio (km)</Label>
            <Select
              id="radiusKm"
              value={String(radiusKm)}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            >
              {[1, 2, 3, 5, 8, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} km
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-4 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={withContact}
                onChange={(e) => setWithContact(e.target.checked)}
              />
              Somente com telefone ou e-mail
            </label>
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={fastMode}
                onChange={(e) => setFastMode(e.target.checked)}
              />
              Modo rápido (escala ~10x)
            </label>
          </div>

          <div className="sm:col-span-2 xl:col-span-4">
            <Label>Campos</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(
                [
                  ['name', 'Nome'],
                  ['phone', 'Telefone'],
                  ['email', 'E-mail'],
                  ['address', 'Endereço'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--accent)]"
                    checked={fields[key]}
                    disabled={key === 'name'}
                    onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-4">
            <Button type="submit" disabled={loading || !canSearch} size="sm">
              {loading && !paused ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? (paused ? 'Pausado' : 'Buscando…') : `Buscar ${limit}`}
            </Button>
            {loading && !paused ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void pauseSearch()}>
                <Pause className="h-4 w-4" /> Pausar
              </Button>
            ) : null}
            {loading && paused ? (
              <Button type="button" size="sm" onClick={() => void resumeSearch()}>
                <Play className="h-4 w-4" /> Continuar
              </Button>
            ) : null}
            {loading ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void cancelSearch()}>
                Cancelar
              </Button>
            ) : null}
            {results.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => exportList(marked.length ? marked : results, 'xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => exportList(marked.length ? marked : results, 'csv')}
                >
                  <FileDown className="h-4 w-4" /> CSV
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={sendMarkedToWhatsApp}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp {marked.length ? `(${marked.length})` : ''}
                </Button>
              </>
            ) : null}
          </div>
        </form>
        {status ? <p className="mt-2 text-xs text-[var(--accent)]">{status}</p> : null}
        {source ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {source} · {results.length}
            {marked.length ? ` · ${marked.length} marcados` : ''}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
        {message ? <p className="mt-2 text-sm text-[var(--accent)]">{message}</p> : null}
      </Card>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div
          ref={listRef}
          className="max-h-[55vh] space-y-2 overflow-y-auto pr-1 xl:max-h-[calc(100vh-280px)]"
        >
          {results.length > 0 ? (
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"
                onClick={toggleAll}
              >
                {checked.size === results.length ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {checked.size === results.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                {marked.length}/{results.length} marcados
              </span>
            </div>
          ) : null}

          {results.map((biz) => (
            <Card
              key={biz.place_id}
              className={cn(
                'flex flex-col gap-2 p-3 transition ring-offset-2',
                selected?.place_id === biz.place_id && 'ring-2 ring-[var(--accent)]',
                checked.has(biz.place_id) && 'border-[var(--accent)]/40',
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1.5 h-4 w-4 accent-[var(--accent)]"
                  checked={checked.has(biz.place_id)}
                  onChange={() => toggleCheck(biz.place_id)}
                  aria-label={`Marcar ${biz.name}`}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setSelected(biz)
                    setEmbedUrl(null)
                    setMapsUrl(null)
                    setMapQuery(
                      biz.lat != null && biz.lng != null
                        ? `${biz.name} @${biz.lat},${biz.lng}`
                        : `${biz.name} ${biz.city} ${biz.state}`,
                    )
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold">{biz.name}</h3>
                      <Badge tone="accent">{CATEGORY_LABELS[biz.category]}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
                    {fields.address && biz.address ? (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {biz.address}
                      </p>
                    ) : null}
                    <p>
                      {biz.city}/{biz.state}
                    </p>
                    {fields.phone ? (
                      biz.phone ? (
                        <p className="flex items-center gap-2 font-semibold text-[var(--accent)]">
                          <Phone className="h-4 w-4" />
                          {biz.phone}
                        </p>
                      ) : (
                        <p className="flex items-center gap-2 text-xs">
                          <Phone className="h-4 w-4" />
                          Sem telefone
                        </p>
                      )
                    ) : null}
                    {fields.email && biz.email ? (
                      <p className="flex items-center gap-2 font-semibold text-[var(--accent)]">
                        <Mail className="h-4 w-4" />
                        {biz.email}
                      </p>
                    ) : null}
                    {biz.website ? (
                      <p className="flex items-center gap-2 text-[var(--accent)]">
                        <Globe className="h-4 w-4" />
                        Website disponível
                      </p>
                    ) : null}
                    {biz.rating != null ? (
                      <p className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        {biz.rating} · {biz.review_count ?? 0} avaliações
                      </p>
                    ) : null}
                  </div>
                </button>
              </div>
              <div className="flex gap-2 pl-7">
                <Button
                  size="sm"
                  onClick={() => void saveLead(biz)}
                  disabled={savingId === biz.place_id}
                >
                  <Plus className="h-4 w-4" />
                  Salvar lead
                </Button>
                {biz.website ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      window.open(
                        biz.website!.startsWith('http') ? biz.website! : `https://${biz.website}`,
                        '_blank',
                      )
                    }
                  >
                    <Globe className="h-4 w-4" />
                    Site
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}

          {loading && results.length === 0 ? (
            <Card className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
              {status || 'Buscando contatos...'}
            </Card>
          ) : null}

          {!loading && results.length === 0 && !error ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Resultados em tempo real · salvos na nuvem. Marque para exportar ou WhatsApp.
              </p>
              {cloudJobs.length ? (
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">Buscas na nuvem</p>
                  {cloudJobs.slice(0, 8).map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--bg-muted)]"
                      onClick={() => void openCloudJob(job)}
                    >
                      <span className="truncate">
                        {(job.params as { city?: string; category?: string }).category || 'busca'} ·{' '}
                        {(job.params as { city?: string }).city || '—'} · {job.result_count}
                      </span>
                      <span className="shrink-0 text-[var(--accent)]">{job.status}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {results.length > 0 && cloudJobs.length ? (
            <div className="mb-2 max-h-24 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Buscas na nuvem</p>
              {cloudJobs.slice(0, 5).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--bg-muted)]"
                  onClick={() => void openCloudJob(job)}
                >
                  <span className="truncate">
                    {(job.params as { city?: string; category?: string }).category || 'busca'} ·{' '}
                    {(job.params as { city?: string }).city || '—'} · {job.result_count}
                  </span>
                  <span className="shrink-0 text-[var(--accent)]">{job.status}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-[280px] xl:sticky xl:top-16 xl:h-[calc(100vh-240px)]">
          <SearchMapPanel
            mapQuery={mapQuery}
            embedUrl={embedUrl}
            mapsUrl={mapsUrl}
            selected={selected}
            status={status}
            resultCount={results.length}
          />
        </div>
      </div>
    </div>
  )
}
