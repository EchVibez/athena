-- Athena: kör hela den här filen en gång i Supabase → SQL Editor → New query → Run.
-- Den skapar tabellerna, skyddar dem så att bara du ser din data och gör en privat bildlagring.

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null,
  data jsonb not null,
  updated bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mime text not null,
  size bigint not null,
  updated bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create index if not exists notes_user_synced on public.notes (user_id, synced_at, id);
create index if not exists pages_user_synced on public.pages (user_id, synced_at, id);
create index if not exists assets_user_synced on public.assets (user_id, synced_at, id);

-- Stämpla varje skrivning med serverns klocka, och låt aldrig en äldre version skriva över en nyare.
create or replace function public.athena_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated < old.updated then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before insert or update on public.notes for each row execute function public.athena_touch();
drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before insert or update on public.pages for each row execute function public.athena_touch();
drop trigger if exists assets_touch on public.assets;
create trigger assets_touch before insert or update on public.assets for each row execute function public.athena_touch();

-- Bara ägaren kommer åt sina rader.
alter table public.notes enable row level security;
alter table public.pages enable row level security;
alter table public.assets enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own pages" on public.pages;
create policy "own pages" on public.pages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own assets" on public.assets;
create policy "own assets" on public.assets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Privat lagring för bilder (inskannade sidor, foton). Varje användare har en egen mapp.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

drop policy if exists "athena own files read" on storage.objects;
create policy "athena own files read" on storage.objects for select to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "athena own files insert" on storage.objects;
create policy "athena own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "athena own files update" on storage.objects;
create policy "athena own files update" on storage.objects for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "athena own files delete" on storage.objects;
create policy "athena own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Livesynk: andra enheter får veta direkt när något ändras.
do $$
begin
  begin alter publication supabase_realtime add table public.notes; exception when others then null; end;
  begin alter publication supabase_realtime add table public.pages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.assets; exception when others then null; end;
end $$;
