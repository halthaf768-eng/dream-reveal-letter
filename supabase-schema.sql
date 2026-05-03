create extension if not exists pgcrypto;

create table if not exists public.reveal_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  customer_name text,
  customer_details jsonb not null default '{}'::jsonb,
  letter_message text not null default '',
  final_message text not null default '',
  future_image_url text not null default '',
  background_music_url text not null default '',
  destination_result_data jsonb not null default '{}'::jsonb,
  admin_created boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reveal_entries_slug_idx
  on public.reveal_entries (slug);

create index if not exists reveal_entries_created_at_idx
  on public.reveal_entries (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reveal_entries_set_updated_at on public.reveal_entries;

create trigger reveal_entries_set_updated_at
before update on public.reveal_entries
for each row
execute function public.set_updated_at();

alter table public.reveal_entries enable row level security;

drop policy if exists "No public browser access to reveal entries" on public.reveal_entries;

create policy "No public browser access to reveal entries"
on public.reveal_entries
for all
using (false)
with check (false);
