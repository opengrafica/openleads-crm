-- OpenLeads CRM schema (coexiste com outros apps no mesmo projeto)
-- Enums
do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_category as enum (
    'restaurante','pizzaria','hamburgueria','grafica','academia','clinica',
    'salao_beleza','oficina','loja','outros'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_status as enum (
    'novo','contatado','interessado','cliente','perdido'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pipeline_stage as enum (
    'novo_lead','primeiro_contato','demonstracao','proposta','cliente'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_type as enum ('follow_up', 'reminder', 'callback');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_plan as enum ('free', 'starter', 'pro', 'enterprise');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'canceled', 'past_due', 'trialing');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.search_job_status as enum (
    'queued','running','paused','completed','failed','cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'user',
  account_status public.account_status not null default 'pending',
  company_name text,
  phone text,
  avatar_url text,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.leads (
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

create index if not exists leads_user_id_idx on public.leads (user_id);

create table if not exists public.tasks (
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

create table if not exists public.search_jobs (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.search_job_status not null default 'queued',
  params jsonb not null default '{}'::jsonb,
  status_message text,
  error_message text,
  maps_url text,
  embed_url text,
  result_count integer not null default 0,
  limit_count integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists search_jobs_user_id_idx on public.search_jobs (user_id);
create index if not exists search_jobs_created_at_idx on public.search_jobs (created_at desc);

create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.search_jobs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (job_id, place_id)
);

create index if not exists search_results_job_id_idx on public.search_results (job_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.openleads_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := 'user';
  v_status public.account_status := 'pending';
begin
  if lower(coalesce(new.email, '')) = 'opengraficaoficial@gmail.com'
     or coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then
    v_role := 'admin';
    v_status := 'approved';
  end if;

  insert into public.profiles (id, email, full_name, role, account_status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    v_status,
    case when v_status = 'approved' then now() else null end
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status, current_period_end)
  values (new.id, 'free', 'trialing', now() + interval '14 days')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_openleads on auth.users;
create trigger on_auth_user_created_openleads
  after insert on auth.users
  for each row execute function public.openleads_handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.account_status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_status = 'approved'
  );
$$;

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.search_jobs enable row level security;
alter table public.search_results enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (public.is_admin());

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "subscriptions_admin_all" on public.subscriptions;
create policy "subscriptions_admin_all" on public.subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads
  for insert to authenticated with check (auth.uid() = user_id and public.is_approved());

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists "search_jobs_select_own" on public.search_jobs;
create policy "search_jobs_select_own" on public.search_jobs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "search_jobs_insert_own" on public.search_jobs;
create policy "search_jobs_insert_own" on public.search_jobs
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());

drop policy if exists "search_jobs_update_own" on public.search_jobs;
create policy "search_jobs_update_own" on public.search_jobs
  for update to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "search_results_select_own" on public.search_results;
create policy "search_results_select_own" on public.search_results
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "search_results_insert_own" on public.search_results;
create policy "search_results_insert_own" on public.search_results
  for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
