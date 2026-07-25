import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { searchLeads } from '@/services/leadsService'
import type { Lead } from '@/types'
import { CATEGORY_LABELS } from '@/types'
import { cn } from '@/lib/utils'

export function GlobalSearch({ className }: { className?: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          setResults(await searchLeads(user.id, query))
          setOpen(true)
        } finally {
          setLoading(false)
        }
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [query, user])

  const empty = useMemo(
    () => !loading && query.trim().length >= 2 && results.length === 0,
    [loading, query, results.length],
  )

  return (
    <div className={cn('relative w-full max-w-xl', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Pesquisar por nome, categoria ou cidade..."
        className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] pl-10 pr-10 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
      />
      {query ? (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          onClick={() => {
            setQuery('')
            setResults([])
            setOpen(false)
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && (results.length > 0 || empty || loading) ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]">
          {loading ? (
            <p className="p-3 text-sm text-[var(--text-muted)]">Buscando...</p>
          ) : empty ? (
            <p className="p-3 text-sm text-[var(--text-muted)]">Nenhum lead encontrado.</p>
          ) : (
            <ul className="max-h-72 overflow-auto py-1">
              {results.slice(0, 8).map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[var(--bg-muted)]"
                    onClick={() => {
                      setOpen(false)
                      navigate(`/crm?lead=${lead.id}`)
                    }}
                  >
                    <span className="text-sm font-semibold">{lead.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {CATEGORY_LABELS[lead.category]} · {lead.city}/{lead.state}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
