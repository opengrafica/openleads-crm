import { demoStore } from '@/lib/demoStore'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Task, TaskType } from '@/types'

export async function listTasks(userId: string): Promise<Task[]> {
  if (!isSupabaseConfigured || !supabase) {
    return demoStore.listTasks(userId)
  }
  const { data, error } = await supabase
    .from('tasks')
    .select('*, lead:leads(id, name, city)')
    .eq('user_id', userId)
    .order('due_at', { ascending: true })
  if (error) throw error
  return data as Task[]
}

export async function createTask(input: {
  user_id: string
  lead_id?: string | null
  title: string
  type: TaskType
  due_at: string
  notes?: string | null
}): Promise<Task> {
  const payload = {
    user_id: input.user_id,
    lead_id: input.lead_id ?? null,
    title: input.title,
    type: input.type,
    due_at: input.due_at,
    completed: false,
    notes: input.notes ?? null,
  }

  if (!isSupabaseConfigured || !supabase) {
    return demoStore.createTask(payload)
  }

  const { data, error } = await supabase.from('tasks').insert(payload).select().single()
  if (error) throw error
  return data as Task
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, 'title' | 'completed' | 'due_at' | 'notes' | 'type'>>,
): Promise<Task> {
  if (!isSupabaseConfigured || !supabase) {
    const updated = demoStore.updateTask(id, patch)
    if (!updated) throw new Error('Tarefa não encontrada')
    return updated
  }
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Task
}

export async function deleteTask(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    demoStore.deleteTask(id)
    return
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
