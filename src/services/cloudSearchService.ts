import { supabase } from '@/lib/supabase'
import type { BusinessResult, LeadCategory } from '@/types'

export type CloudSearchJob = {
  id: string
  user_id: string
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  params: Record<string, unknown>
  status_message: string | null
  error_message: string | null
  maps_url: string | null
  embed_url: string | null
  result_count: number
  limit_count: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export async function createCloudSearchJob(input: {
  id: string
  userId: string
  params: {
    category: LeadCategory
    city?: string
    state?: string
    query?: string
    cep?: string
    limit: number
    radiusKm?: number
    withContact?: boolean
    fast?: boolean
  }
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('search_jobs')
    .insert({
      id: input.id,
      user_id: input.userId,
      status: 'running',
      params: input.params,
      status_message: 'Iniciando busca na nuvem…',
      limit_count: input.params.limit,
      result_count: 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CloudSearchJob
}

export async function updateCloudSearchJob(
  jobId: string,
  patch: Partial<{
    status: CloudSearchJob['status']
    status_message: string
    error_message: string
    maps_url: string
    embed_url: string
    result_count: number
    completed_at: string
  }>,
) {
  if (!supabase) return
  await supabase
    .from('search_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

export async function appendCloudSearchResult(input: {
  jobId: string
  userId: string
  place: BusinessResult
}) {
  if (!supabase) return
  await supabase.from('search_results').upsert(
    {
      job_id: input.jobId,
      user_id: input.userId,
      place_id: input.place.place_id,
      payload: input.place,
    },
    { onConflict: 'job_id,place_id' },
  )
}

export async function listCloudSearchJobs(userId: string, limit = 20) {
  if (!supabase) return [] as CloudSearchJob[]
  const { data, error } = await supabase
    .from('search_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as CloudSearchJob[]
}

export async function loadCloudSearchResults(jobId: string): Promise<BusinessResult[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('search_results')
    .select('payload')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((row) => row.payload as BusinessResult)
}

export async function getCloudSearchJob(jobId: string) {
  if (!supabase) return null
  const { data } = await supabase.from('search_jobs').select('*').eq('id', jobId).maybeSingle()
  return (data as CloudSearchJob) || null
}
