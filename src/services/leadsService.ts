import { demoStore } from '@/lib/demoStore'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type {
  BusinessResult,
  Lead,
  LeadStatus,
  PipelineStage,
} from '@/types'

export async function listLeads(userId: string): Promise<Lead[]> {
  if (!isSupabaseConfigured || !supabase) {
    return demoStore.listLeads(userId)
  }
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Lead[]
}

export async function searchLeads(userId: string, query: string): Promise<Lead[]> {
  if (!isSupabaseConfigured || !supabase) {
    return demoStore.searchLeads(userId, query)
  }
  const term = query.trim()
  if (!term) return listLeads(userId)
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .or(`name.ilike.%${term}%,city.ilike.%${term}%,category.ilike.%${term}%`)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Lead[]
}

export async function saveLeadFromBusiness(
  userId: string,
  business: BusinessResult,
  notes?: string,
): Promise<Lead> {
  const payload = {
    user_id: userId,
    place_id: business.place_id,
    name: business.name,
    category: business.category,
    city: business.city,
    state: business.state,
    website: business.website,
    address: business.address,
    rating: business.rating,
    review_count: business.review_count,
    phone: business.phone,
    email: business.email ?? null,
    notes: notes ?? null,
    status: 'novo' as LeadStatus,
    pipeline_stage: 'novo_lead' as PipelineStage,
  }

  if (!isSupabaseConfigured || !supabase) {
    return demoStore.createLead(payload)
  }

  const { data, error } = await supabase.from('leads').insert(payload).select().single()
  if (error) throw error
  return data as Lead
}

export async function updateLead(
  id: string,
  patch: Partial<
    Pick<Lead, 'notes' | 'status' | 'pipeline_stage' | 'name' | 'phone' | 'email' | 'website'>
  >,
): Promise<Lead> {
  if (!isSupabaseConfigured || !supabase) {
    const updated = demoStore.updateLead(id, patch)
    if (!updated) throw new Error('Lead não encontrado')
    return updated
  }
  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    demoStore.deleteLead(id)
    return
  }
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}
