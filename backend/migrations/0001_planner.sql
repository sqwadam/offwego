-- Journeys planner schema (native Supabase Auth, RLS via auth.uid())

create table if not exists public.planner_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled trip',
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planner_trips enable row level security;

create policy "planner_trips_select_own" on public.planner_trips
  for select using (auth.uid() = owner_id);
create policy "planner_trips_insert_own" on public.planner_trips
  for insert with check (auth.uid() = owner_id);
create policy "planner_trips_update_own" on public.planner_trips
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "planner_trips_delete_own" on public.planner_trips
  for delete using (auth.uid() = owner_id);

create index if not exists planner_trips_owner_idx on public.planner_trips (owner_id, updated_at desc);

create table if not exists public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "user_roles_select_own" on public.user_roles
  for select using (auth.uid() = user_id);
