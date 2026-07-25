import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { AdminStats, DashboardStats, Lead, Profile, Subscription } from '@/types'

export function computeDashboardStats(leads: Lead[]): DashboardStats {
  const totalLeads = leads.length
  const closedClients = leads.filter((l) => l.status === 'cliente').length
  const conversionRate = totalLeads ? Math.round((closedClients / totalLeads) * 1000) / 10 : 0

  const cityMap = new Map<string, number>()
  for (const l of leads) cityMap.set(l.city, (cityMap.get(l.city) ?? 0) + 1)
  const leadsByCity = [...cityMap.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)

  const statusMap = new Map<Lead['status'], number>()
  for (const l of leads) statusMap.set(l.status, (statusMap.get(l.status) ?? 0) + 1)
  const leadsByStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }))

  const pipelineMap = new Map<Lead['pipeline_stage'], number>()
  for (const l of leads) {
    pipelineMap.set(l.pipeline_stage, (pipelineMap.get(l.pipeline_stage) ?? 0) + 1)
  }
  const leadsByPipeline = [...pipelineMap.entries()].map(([stage, count]) => ({
    stage,
    count,
  }))

  return {
    totalLeads,
    closedClients,
    conversionRate,
    leadsByCity,
    leadsByStatus,
    leadsByPipeline,
  }
}

const PLAN_PRICE: Record<Subscription['plan'], number> = {
  free: 0,
  starter: 49,
  pro: 149,
  enterprise: 499,
}

export async function getAdminData(): Promise<{
  users: Profile[]
  subscriptions: Subscription[]
  stats: AdminStats
}> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  const [{ data: users, error: uErr }, { data: subscriptions, error: sErr }, { count }] =
    await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*'),
      supabase.from('leads').select('*', { count: 'exact', head: true }),
    ])
  if (uErr) throw uErr
  if (sErr) throw sErr

  const subs = (subscriptions ?? []) as Subscription[]
  const profiles = (users ?? []) as Profile[]
  const planMap = new Map<Subscription['plan'], number>()
  for (const s of subs) planMap.set(s.plan, (planMap.get(s.plan) ?? 0) + 1)

  const approvedClients = profiles.filter(
    (u) => u.account_status === 'approved' && u.role !== 'admin',
  ).length
  const pendingClients = profiles.filter((u) => u.account_status === 'pending').length

  return {
    users: profiles,
    subscriptions: subs,
    stats: {
      totalUsers: profiles.length,
      activeSubscriptions: subs.filter((s) => s.status === 'active' || s.status === 'trialing')
        .length,
      totalLeads: count ?? 0,
      revenueEstimate: subs
        .filter((s) => s.status === 'active')
        .reduce((acc, s) => acc + PLAN_PRICE[s.plan], 0),
      usersByPlan: [...planMap.entries()].map(([plan, count]) => ({ plan, count })),
      approvedClients,
      pendingClients,
    },
  }
}

export async function adminUpdateUserRole(userId: string, role: Profile['role']) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

export async function adminUpdateSubscription(
  userId: string,
  patch: Partial<Pick<Subscription, 'plan' | 'status'>>,
) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }
  const { error } = await supabase.from('subscriptions').update(patch).eq('user_id', userId)
  if (error) throw error
}

export async function adminSetAccountStatus(
  userId: string,
  status: 'pending' | 'approved' | 'rejected',
  approvedBy?: string,
) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }
  const { error } = await supabase
    .from('profiles')
    .update({
      account_status: status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      approved_by: status === 'approved' ? approvedBy || null : null,
    })
    .eq('id', userId)
  if (error) throw error
}
