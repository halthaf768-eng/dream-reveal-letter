create extension if not exists pgcrypto;

create table if not exists public.reveals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text,
  message text,
  future_image text,
  destination text,
  email text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists reveals_slug_idx
  on public.reveals (slug);

create index if not exists reveals_created_at_idx
  on public.reveals (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reveals_set_updated_at on public.reveals;

create trigger reveals_set_updated_at
before update on public.reveals
for each row
execute function public.set_updated_at();

alter table public.reveals enable row level security;

drop policy if exists "No public browser access to reveals" on public.reveals;

create policy "No public browser access to reveals"
on public.reveals
for all
using (false)
with check (false);
