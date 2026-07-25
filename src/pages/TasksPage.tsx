import { useState, type FormEvent } from 'react'
import { Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLeads } from '@/hooks/useLeads'
import { useTasks } from '@/hooks/useTasks'
import { createTask, deleteTask, updateTask } from '@/services/tasksService'
import type { TaskType } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select, Textarea } from '@/components/ui/Input'
import { Badge, Card } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/utils'

export function TasksPage() {
  const { user } = useAuth()
  const { leads } = useLeads()
  const { tasks, loading, refresh } = useTasks()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('follow_up')
  const [dueAt, setDueAt] = useState('')
  const [leadId, setLeadId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !dueAt) return
    setSubmitting(true)
    try {
      await createTask({
        user_id: user.id,
        title,
        type,
        due_at: new Date(dueAt).toISOString(),
        lead_id: leadId || null,
        notes: notes || null,
      })
      setTitle('')
      setNotes('')
      setLeadId('')
      setDueAt('')
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Tarefas</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Agende retornos, lembretes e follow-ups.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="font-display text-lg font-semibold">Nova tarefa</h2>
          <form className="mt-4 space-y-3" onSubmit={onCreate}>
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Data / hora</Label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Lead (opcional)</Label>
              <Select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                <option value="">Nenhum</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={submitting}>
              <Plus className="h-4 w-4" />
              {submitting ? 'Criando...' : 'Criar tarefa'}
            </Button>
          </form>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Agenda</h2>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-[var(--text-muted)]">Carregando...</p>
          ) : tasks.length === 0 ? (
            <p className="p-5 text-sm text-[var(--text-muted)]">Nenhuma tarefa ainda.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3 px-5 py-4">
                  <button
                    type="button"
                    className="mt-0.5 text-[var(--accent)]"
                    onClick={() =>
                      void updateTask(task.id, { completed: !task.completed }).then(() =>
                        refresh(),
                      )
                    }
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${task.completed ? 'line-through opacity-60' : ''}`}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Badge tone="accent">{TASK_TYPE_LABELS[task.type]}</Badge>
                      <span>{formatDateTime(task.due_at)}</span>
                      {task.lead ? <span>· {task.lead.name}</span> : null}
                    </div>
                    {task.notes ? (
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{task.notes}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                    onClick={() => void deleteTask(task.id).then(() => refresh())}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
