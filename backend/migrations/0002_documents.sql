-- Documents: user-uploaded confirmations and tickets, stored in a private bucket.

create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null unique,
  mime text not null default 'application/octet-stream',
  size bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trip_documents enable row level security;

create policy "trip_documents_select_own" on public.trip_documents
  for select using (auth.uid() = owner_id);
create policy "trip_documents_insert_own" on public.trip_documents
  for insert with check (auth.uid() = owner_id);
create policy "trip_documents_delete_own" on public.trip_documents
  for delete using (auth.uid() = owner_id);

create index if not exists trip_documents_owner_idx on public.trip_documents (owner_id, created_at desc);

insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_read_own" on storage.objects;
drop policy if exists "documents_insert_own" on storage.objects;
drop policy if exists "documents_delete_own" on storage.objects;
create policy "documents_read_own" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid() = owner);
create policy "documents_insert_own" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.uid() = owner);
create policy "documents_delete_own" on storage.objects
  for delete using (bucket_id = 'documents' and auth.uid() = owner);
