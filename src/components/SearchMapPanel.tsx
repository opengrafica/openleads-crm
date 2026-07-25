import { ExternalLink, MapPinned } from 'lucide-react'
import type { BusinessResult } from '@/types'

interface SearchMapPanelProps {
  mapQuery: string
  embedUrl?: string | null
  mapsUrl?: string | null
  selected?: BusinessResult | null
  status?: string | null
  resultCount: number
}

function buildMapsEmbedUrl(query: string) {
  const q = query.trim() || 'Brasil'
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=pt-BR&z=15&output=embed`
}

function buildMapsOpenUrl(query: string) {
  const q = query.trim() || 'Brasil'
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}?hl=pt-BR`
}

export function SearchMapPanel({
  mapQuery,
  embedUrl,
  mapsUrl,
  selected,
  status,
  resultCount,
}: SearchMapPanelProps) {
  const focusQuery = selected
    ? selected.lat != null && selected.lng != null
      ? `${selected.name} @${selected.lat},${selected.lng}`
      : `${selected.name} ${selected.address} ${selected.city} ${selected.state}`
    : mapQuery

  // Prioriza URL ao vivo do scraper (mapa acompanha a captura em tempo real)
  const iframeSrc = embedUrl || (selected ? buildMapsEmbedUrl(focusQuery) : buildMapsEmbedUrl(mapQuery))

  const openHref = mapsUrl || (selected ? buildMapsOpenUrl(focusQuery) : buildMapsOpenUrl(mapQuery))

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <p className="text-sm font-semibold">Google Maps</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {status || (resultCount ? `${resultCount} no mapa` : 'Aguardando busca')}
            </p>
          </div>
        </div>
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--bg-muted)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir Maps
        </a>
      </div>
      <div className="relative min-h-0 flex-1 bg-[var(--bg-muted)]">
        <iframe
          key={iframeSrc}
          title="Mapa"
          src={iframeSrc}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  )
}
