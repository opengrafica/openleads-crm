import type {
  Lead,
  LeadCategory,
  LeadStatus,
  PipelineStage,
  Profile,
  Subscription,
  Task,
  TaskType,
} from '@/types'
import { uid } from '@/lib/utils'

const KEY = 'openleads-demo-store'

interface DemoStore {
  profile: Profile
  subscription: Subscription
  leads: Lead[]
  tasks: Task[]
  users: Profile[]
  subscriptions: Subscription[]
}

function seed(): DemoStore {
  const now = new Date().toISOString()
  const userId = 'demo-user-001'
  const adminId = 'demo-admin-001'

  const profile: Profile = {
    id: userId,
    email: 'demo@openleads.app',
    full_name: 'Usuário Demo',
    role: 'user',
    avatar_url: null,
    created_at: now,
    updated_at: now,
  }

  const admin: Profile = {
    id: adminId,
    email: 'admin@openleads.app',
    full_name: 'Admin OpenLeads',
    role: 'admin',
    avatar_url: null,
    created_at: now,
    updated_at: now,
  }

  const subscription: Subscription = {
    id: uid('sub'),
    user_id: userId,
    plan: 'pro',
    status: 'active',
    current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: now,
    updated_at: now,
  }

  const leads: Lead[] = [
    {
      id: uid('lead'),
      user_id: userId,
      place_id: 'demo_1',
      name: 'Pizzaria Napoli',
      category: 'pizzaria',
      city: 'São Paulo',
      state: 'SP',
      website: 'https://pizzarianapoli.exemplo.com',
      address: 'Rua Augusta, 1200 — Consolação',
      rating: 4.6,
      review_count: 312,
      phone: '(11) 3456-7890',
      notes: 'Interessados em cardápio digital.',
      status: 'interessado',
      pipeline_stage: 'demonstracao',
      created_at: now,
      updated_at: now,
    },
    {
      id: uid('lead'),
      user_id: userId,
      place_id: 'demo_2',
      name: 'Academia Force Fit',
      category: 'academia',
      city: 'Campinas',
      state: 'SP',
      website: null,
      address: 'Av. Norte-Sul, 450',
      rating: 4.2,
      review_count: 89,
      phone: '(19) 99888-1122',
      notes: null,
      status: 'novo',
      pipeline_stage: 'novo_lead',
      created_at: now,
      updated_at: now,
    },
    {
      id: uid('lead'),
      user_id: userId,
      place_id: 'demo_3',
      name: 'Gráfica Express Print',
      category: 'grafica',
      city: 'Curitiba',
      state: 'PR',
      website: 'https://expressprint.exemplo.com',
      address: 'Rua XV de Novembro, 88',
      rating: 4.8,
      review_count: 54,
      phone: '(41) 3333-4444',
      notes: 'Cliente fechado — plano anual.',
      status: 'cliente',
      pipeline_stage: 'cliente',
      created_at: now,
      updated_at: now,
    },
    {
      id: uid('lead'),
      user_id: userId,
      place_id: 'demo_4',
      name: 'Clínica Vida Saudável',
      category: 'clinica',
      city: 'Belo Horizonte',
      state: 'MG',
      website: 'https://vidasaudavel.exemplo.com',
      address: 'Av. Afonso Pena, 1500',
      rating: 4.5,
      review_count: 201,
      phone: '(31) 3222-1000',
      notes: 'Aguardando retorno da proposta.',
      status: 'contatado',
      pipeline_stage: 'proposta',
      created_at: now,
      updated_at: now,
    },
    {
      id: uid('lead'),
      user_id: userId,
      place_id: 'demo_5',
      name: 'Burger Lab',
      category: 'hamburgueria',
      city: 'São Paulo',
      state: 'SP',
      website: null,
      address: 'Rua dos Pinheiros, 700',
      rating: 4.7,
      review_count: 480,
      phone: '(11) 97777-5555',
      notes: null,
      status: 'novo',
      pipeline_stage: 'primeiro_contato',
      created_at: now,
      updated_at: now,
    },
  ]

  const tasks: Task[] = [
    {
      id: uid('task'),
      user_id: userId,
      lead_id: leads[0].id,
      title: 'Follow-up demonstração Napoli',
      type: 'follow_up',
      due_at: new Date(Date.now() + 86400000).toISOString(),
      completed: false,
      notes: 'Enviar link da demo',
      created_at: now,
      updated_at: now,
    },
    {
      id: uid('task'),
      user_id: userId,
      lead_id: leads[3].id,
      title: 'Retorno proposta clínica',
      type: 'callback',
      due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      completed: false,
      notes: null,
      created_at: now,
      updated_at: now,
    },
  ]

  return {
    profile,
    subscription,
    leads,
    tasks,
    users: [profile, admin],
    subscriptions: [
      subscription,
      {
        id: uid('sub'),
        user_id: adminId,
        plan: 'enterprise',
        status: 'active',
        current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
        created_at: now,
        updated_at: now,
      },
    ],
  }
}

function read(): DemoStore {
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    const s = seed()
    write(s)
    return s
  }
  try {
    return JSON.parse(raw) as DemoStore
  } catch {
    const s = seed()
    write(s)
    return s
  }
}

function write(store: DemoStore) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

export const demoStore = {
  getProfile(asAdmin = false): Profile {
    const s = read()
    if (asAdmin) {
      return s.users.find((u) => u.role === 'admin') ?? s.profile
    }
    return s.profile
  },

  setProfile(profile: Profile) {
    const s = read()
    s.profile = profile
    s.users = s.users.map((u) => (u.id === profile.id ? profile : u))
    write(s)
  },

  getSubscription(userId: string): Subscription | undefined {
    return read().subscriptions.find((x) => x.user_id === userId)
  },

  listLeads(userId: string): Lead[] {
    return read().leads.filter((l) => l.user_id === userId)
  },

  createLead(input: Omit<Lead, 'id' | 'created_at' | 'updated_at'>): Lead {
    const s = read()
    const now = new Date().toISOString()
    const lead: Lead = { ...input, id: uid('lead'), created_at: now, updated_at: now }
    s.leads.unshift(lead)
    write(s)
    return lead
  },

  updateLead(id: string, patch: Partial<Lead>): Lead | null {
    const s = read()
    const i = s.leads.findIndex((l) => l.id === id)
    if (i < 0) return null
    s.leads[i] = { ...s.leads[i], ...patch, updated_at: new Date().toISOString() }
    write(s)
    return s.leads[i]
  },

  deleteLead(id: string) {
    const s = read()
    s.leads = s.leads.filter((l) => l.id !== id)
    s.tasks = s.tasks.map((t) => (t.lead_id === id ? { ...t, lead_id: null } : t))
    write(s)
  },

  listTasks(userId: string): Task[] {
    const s = read()
    return s.tasks
      .filter((t) => t.user_id === userId)
      .map((t) => ({
        ...t,
        lead: t.lead_id
          ? (() => {
              const lead = s.leads.find((l) => l.id === t.lead_id)
              return lead ? { id: lead.id, name: lead.name, city: lead.city } : null
            })()
          : null,
      }))
  },

  createTask(
    input: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'lead'>,
  ): Task {
    const s = read()
    const now = new Date().toISOString()
    const task: Task = { ...input, id: uid('task'), created_at: now, updated_at: now }
    s.tasks.unshift(task)
    write(s)
    return task
  },

  updateTask(id: string, patch: Partial<Task>): Task | null {
    const s = read()
    const i = s.tasks.findIndex((t) => t.id === id)
    if (i < 0) return null
    s.tasks[i] = { ...s.tasks[i], ...patch, updated_at: new Date().toISOString() }
    write(s)
    return s.tasks[i]
  },

  deleteTask(id: string) {
    const s = read()
    s.tasks = s.tasks.filter((t) => t.id !== id)
    write(s)
  },

  listUsers(): Profile[] {
    return read().users
  },

  listSubscriptions(): Subscription[] {
    return read().subscriptions
  },

  updateUserRole(userId: string, role: Profile['role']) {
    const s = read()
    s.users = s.users.map((u) =>
      u.id === userId ? { ...u, role, updated_at: new Date().toISOString() } : u,
    )
    if (s.profile.id === userId) s.profile.role = role
    write(s)
  },

  updateSubscription(
    userId: string,
    patch: Partial<Pick<Subscription, 'plan' | 'status'>>,
  ) {
    const s = read()
    s.subscriptions = s.subscriptions.map((sub) =>
      sub.user_id === userId
        ? { ...sub, ...patch, updated_at: new Date().toISOString() }
        : sub,
    )
    if (s.subscription.user_id === userId) {
      s.subscription = { ...s.subscription, ...patch }
    }
    write(s)
  },

  searchLeads(userId: string, q: string): Lead[] {
    const term = q.trim().toLowerCase()
    if (!term) return this.listLeads(userId)
    return this.listLeads(userId).filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.category.toLowerCase().includes(term) ||
        l.city.toLowerCase().includes(term) ||
        l.state.toLowerCase().includes(term),
    )
  },
}

export type { LeadCategory, LeadStatus, PipelineStage, TaskType }
