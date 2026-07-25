-- OpenLeads CRM — schema inicial
-- Extensões
create extension if not exists "pgcrypto";

-- Enums
create type public.user_role as enum ('user', 'admin');
create type public.lead_category as enum (
  'restaurante',
  'pizzaria',
  'hamburgueria',
  'grafica',
  'academia',
  'clinica',
  'salao_beleza',
  'oficina',
  'loja',
  'outros'
);
create type public.lead_status as enum (
  'novo',
  'contatado',
  'interessado',
  'cliente',
  'perdido'
);
create type public.pipeline_stage as enum (
  'novo_lead',
  'primeiro_contato',
  'demonstracao',
  'proposta',
  'cliente'
);
create type public.task_type as enum ('follow_up', 'reminder', 'callback');
create type public.subscription_plan as enum ('free', 'starter', 'pro', 'enterprise');
create type public.subscription_status as enum ('active', 'canceled', 'past_due', 'trialing');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'user',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Leads
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id text,
  name text not null,
  category public.lead_category not null default 'outros',
  city text not null,
  state text not null,
  website text,
  address text not null default '',
  rating numeric(2,1),
  review_count integer,
  phone text,
  email text,
  notes text,
  status public.lead_status not null default 'novo',
  pipeline_stage public.pipeline_stage not null default 'novo_lead',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_user_id_idx on public.leads (user_id);
create index leads_city_idx on public.leads (city);
create index leads_category_idx on public.leads (category);
create index leads_status_idx on public.leads (status);
create index leads_pipeline_idx on public.leads (pipeline_stage);
-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  title text not null,
  type public.task_type not null default 'reminder',
  due_at timestamptz not null,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_completed_idx on public.tasks (completed);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Novo usuário → profile + subscription free
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'user')
  );

  insert into public.subscriptions (user_id, plan, status, current_period_end)
  values (new.id, 'free', 'trialing', now() + interval '14 days');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is_admin via profiles (não usar user_metadata)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;

-- Profiles policies
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_admin_update"
  on public.profiles for update
  using (public.is_admin());

-- Subscriptions policies
create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "subscriptions_admin_all"
  on public.subscriptions for all
  using (public.is_admin())
  with check (public.is_admin());

-- Leads policies
create policy "leads_select_own"
  on public.leads for select
  using (auth.uid() = user_id or public.is_admin());

create policy "leads_insert_own"
  on public.leads for insert
  with check (auth.uid() = user_id);

create policy "leads_update_own"
  on public.leads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "leads_delete_own"
  on public.leads for delete
  using (auth.uid() = user_id or public.is_admin());

-- Tasks policies
create policy "tasks_select_own"
  on public.tasks for select
  using (auth.uid() = user_id or public.is_admin());

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_delete_own"
  on public.tasks for delete
  using (auth.uid() = user_id or public.is_admin());
