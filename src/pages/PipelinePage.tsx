import { useMemo, useState } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { updateLead } from '@/services/leadsService'
import type { Lead, PipelineStage } from '@/types'
import { CATEGORY_LABELS, PIPELINE_LABELS, PIPELINE_STAGES } from '@/types'
import { Badge } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export function PipelinePage() {
  const { leads, loading, refresh } = useLeads()
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const columns = useMemo(() => {
    const map = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as Lead[]])) as Record<
      PipelineStage,
      Lead[]
    >
    for (const lead of leads) {
      map[lead.pipeline_stage]?.push(lead)
    }
    return map
  }, [leads])

  async function moveLead(leadId: string, stage: PipelineStage) {
    const patch: Partial<Pick<Lead, 'pipeline_stage' | 'status'>> = {
      pipeline_stage: stage,
    }
    if (stage === 'cliente') patch.status = 'cliente'
    await updateLead(leadId, patch)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Pipeline Kanban</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Arraste os cards entre as etapas do funil comercial.
        </p>
      </div>

      {loading ? (
        <p className="text-[var(--text-muted)]">Carregando...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage}
              className="min-w-[260px] flex-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingId) void moveLead(draggingId, stage)
                setDraggingId(null)
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
                  {PIPELINE_LABELS[stage]}
                </h2>
                <Badge>{columns[stage].length}</Badge>
              </div>
              <div className="min-h-40 space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-muted)_55%,transparent)] p-2">
                {columns[stage].map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggingId(lead.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={cn(
                      'cursor-grab rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow)] active:cursor-grabbing',
                      draggingId === lead.id && 'opacity-60',
                    )}
                  >
                    <p className="font-semibold">{lead.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {CATEGORY_LABELS[lead.category]} · {lead.city}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
