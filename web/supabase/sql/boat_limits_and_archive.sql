-- Boat limits and archive
-- Run after boatmatey_setup.sql.
-- Adds boat status, boat_links table, limits (enforced in app), and archive_boat function.

-- 1) boats.status ------------------------------------------------------------

alter table public.boats
  add column if not exists status text not null default 'active'
  check (status in ('active', 'archived'));

create index if not exists idx_boats_status on public.boats(status);
create index if not exists idx_boats_owner_status on public.boats(owner_id, status);

comment on column public.boats.status is 'active = editable; archived = read-only, some files removed';

-- 2) boat_links (Web Links section; deleted entirely on archive) -------------

create table if not exists public.boat_links (
  id          uuid primary key default gen_random_uuid(),
  boat_id     uuid not null references public.boats(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  url         text not null,
  created_at  timestamptz default timezone('utc', now())
);

create index if not exists idx_boat_links_boat_id on public.boat_links(boat_id);
create index if not exists idx_boat_links_owner_id on public.boat_links(owner_id);

alter table public.boat_links enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_links' and policyname = 'boat_links_select_own') then
    create policy boat_links_select_own on public.boat_links for select
      using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_links' and policyname = 'boat_links_insert_own') then
    create policy boat_links_insert_own on public.boat_links for insert
      with check (
        owner_id = (select auth.uid())
        and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid()) and b.status = 'active')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_links' and policyname = 'boat_links_update_own') then
    create policy boat_links_update_own on public.boat_links for update
      using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid()) and b.status = 'active'))
      with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_links' and policyname = 'boat_links_delete_own') then
    create policy boat_links_delete_own on public.boat_links for delete
      using (owner_id = (select auth.uid()));
  end if;
end $$;

-- 3) archive_boat(p_boat_id) -------------------------------------------------
-- Sets boat to archived, removes attachment rows for disallowed sections,
-- and deletes all boat_links. Storage object deletion is done by the client
-- after this returns (using paths from attachments before delete).

create or replace function public.archive_boat(p_boat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.boats where id = p_boat_id;
  if v_owner_id is null or v_owner_id != auth.uid() then
    raise exception 'Boat not found or access denied';
  end if;

  -- Only active boats can be archived
  update public.boats
  set status = 'archived', updated_at = timezone('utc', now())
  where id = p_boat_id and status = 'active';

  if not found then
    raise exception 'Boat not found or already archived';
  end if;

  -- Remove attachment rows for sections that must not retain files when archived.
  -- Keep: service, logbook. Delete: boat, engine, equipment, haulout.
  delete from public.attachments
  where boat_id = p_boat_id
    and entity_type in ('boat', 'engine', 'equipment', 'haulout');

  -- Remove all link records for this boat
  delete from public.boat_links where boat_id = p_boat_id;
end;
$$;

comment on function public.archive_boat(uuid) is 'Archives a boat: status=archived, removes attachments for engine/equipment/haulout/boat, deletes boat_links. Client should delete storage objects for removed attachments.';

-- 4) reactivate_boat(p_boat_id) -----------------------------------------------
-- Caller must enforce active boat limit before calling.

create or replace function public.reactivate_boat(p_boat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.boats where id = p_boat_id;
  if v_owner_id is null or v_owner_id != auth.uid() then
    raise exception 'Boat not found or access denied';
  end if;

  update public.boats
  set status = 'active', updated_at = timezone('utc', now())
  where id = p_boat_id and status = 'archived';

  if not found then
    raise exception 'Boat not found or not archived';
  end if;
end;
$$;
