export type UserRole = 'user' | 'admin' | 'customer'

export type AccountStatus = 'pending' | 'approved' | 'rejected'

export type LeadCategory =
  | 'restaurante'
  | 'pizzaria'
  | 'hamburgueria'
  | 'grafica'
  | 'academia'
  | 'clinica'
  | 'salao_beleza'
  | 'oficina'
  | 'loja'
  | 'outros'

export type LeadStatus =
  | 'novo'
  | 'contatado'
  | 'interessado'
  | 'cliente'
  | 'perdido'

export type PipelineStage =
  | 'novo_lead'
  | 'primeiro_contato'
  | 'demonstracao'
  | 'proposta'
  | 'cliente'

export type TaskType = 'follow_up' | 'reminder' | 'callback'

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  account_status?: AccountStatus
  company_name?: string | null
  phone?: string | null
  avatar_url: string | null
  approved_at?: string | null
  approved_by?: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface BusinessResult {
  place_id: string
  name: string
  category: LeadCategory
  city: string
  state: string
  website: string | null
  address: string
  rating: number | null
  review_count: number | null
  phone: string | null
  email?: string | null
  lat?: number | null
  lng?: number | null
}

export interface Lead {
  id: string
  user_id: string
  place_id: string | null
  name: string
  category: LeadCategory
  city: string
  state: string
  website: string | null
  address: string
  rating: number | null
  review_count: number | null
  phone: string | null
  email?: string | null
  notes: string | null
  status: LeadStatus
  pipeline_stage: PipelineStage
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  lead_id: string | null
  title: string
  type: TaskType
  due_at: string
  completed: boolean
  notes: string | null
  created_at: string
  updated_at: string
  lead?: Pick<Lead, 'id' | 'name' | 'city'> | null
}

export interface DashboardStats {
  totalLeads: number
  closedClients: number
  conversionRate: number
  leadsByCity: { city: string; count: number }[]
  leadsByStatus: { status: LeadStatus; count: number }[]
  leadsByPipeline: { stage: PipelineStage; count: number }[]
}

export interface AdminStats {
  totalUsers: number
  activeSubscriptions: number
  totalLeads: number
  revenueEstimate: number
  usersByPlan: { plan: SubscriptionPlan; count: number }[]
  approvedClients?: number
  pendingClients?: number
}

export const CATEGORY_LABELS: Record<LeadCategory, string> = {
  restaurante: 'Restaurante',
  pizzaria: 'Pizzaria',
  hamburgueria: 'Hamburgueria',
  grafica: 'Gráfica',
  academia: 'Academia',
  clinica: 'Clínica',
  salao_beleza: 'Salão de beleza',
  oficina: 'Oficina',
  loja: 'Loja',
  outros: 'Outros',
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  interessado: 'Interessado',
  cliente: 'Cliente',
  perdido: 'Perdido',
}

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  novo_lead: 'Novo Lead',
  primeiro_contato: 'Primeiro Contato',
  demonstracao: 'Demonstração',
  proposta: 'Proposta',
  cliente: 'Cliente',
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  follow_up: 'Follow-up',
  reminder: 'Lembrete',
  callback: 'Agendar retorno',
}

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export const PIPELINE_STAGES: PipelineStage[] = [
  'novo_lead',
  'primeiro_contato',
  'demonstracao',
  'proposta',
  'cliente',
]

export const LEAD_CATEGORIES: LeadCategory[] = [
  'restaurante',
  'pizzaria',
  'hamburgueria',
  'grafica',
  'academia',
  'clinica',
  'salao_beleza',
  'oficina',
  'loja',
  'outros',
]
