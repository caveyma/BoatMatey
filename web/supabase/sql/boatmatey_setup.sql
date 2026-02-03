-- BoatMatey core schema, RLS, and storage setup
-- Run this once in the Supabase SQL Editor.

-- Extensions ------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Helper to auto-update updated_at -------------------------------------------

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Tables ----------------------------------------------------------------------

-- 0) profiles (per-user account metadata) -------------------------------------

create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text null,
  full_name                text null,
  subscription_plan        text null,
  subscription_status      text null,
  subscription_expires_at  timestamptz null,
  metadata                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz default timezone('utc', now()),
  updated_at               timestamptz default timezone('utc', now())
);

create index if not exists idx_profiles_subscription_status on public.profiles(subscription_status);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.handle_updated_at();

-- 1) boats --------------------------------------------------------------------

create table if not exists public.boats (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  make        text null,
  model       text null,
  year        int  null,
  hull_id     text null,
  length_m    numeric null,
  beam_m      numeric null,
  draft_m     numeric null,
  created_at  timestamptz default timezone('utc', now()),
  updated_at  timestamptz default timezone('utc', now())
);

create index if not exists idx_boats_owner_id on public.boats(owner_id);
create index if not exists idx_boats_year on public.boats(year);

drop trigger if exists trg_boats_updated_at on public.boats;
create trigger trg_boats_updated_at
before update on public.boats
for each row
execute procedure public.handle_updated_at();

-- 2) engines ------------------------------------------------------------------

create table if not exists public.engines (
  id          uuid primary key default gen_random_uuid(),
  boat_id     uuid not null references public.boats(id) on delete cascade,
  owner_id    uuid not null,
  position    text null, -- e.g. port/starboard
  make        text null,
  model       text null,
  serial      text null,
  hours       numeric null,
  notes       text null,
  created_at  timestamptz default timezone('utc', now()),
  updated_at  timestamptz default timezone('utc', now())
);

create index if not exists idx_engines_owner_id on public.engines(owner_id);
create index if not exists idx_engines_boat_id on public.engines(boat_id);
create index if not exists idx_engines_boat_owner on public.engines(boat_id, owner_id);

drop trigger if exists trg_engines_updated_at on public.engines;
create trigger trg_engines_updated_at
before update on public.engines
for each row
execute procedure public.handle_updated_at();

-- 3) service_entries ----------------------------------------------------------

create table if not exists public.service_entries (
  id          uuid primary key default gen_random_uuid(),
  boat_id     uuid not null references public.boats(id) on delete cascade,
  engine_id   uuid null references public.engines(id) on delete set null,
  owner_id    uuid not null,
  service_date date not null,
  title       text not null,
  description text null,
  cost        numeric null,
  provider    text null,
  created_at  timestamptz default timezone('utc', now()),
  updated_at  timestamptz default timezone('utc', now())
);

create index if not exists idx_service_entries_owner_id on public.service_entries(owner_id);
create index if not exists idx_service_entries_boat_id on public.service_entries(boat_id);
create index if not exists idx_service_entries_engine_id on public.service_entries(engine_id);
create index if not exists idx_service_entries_boat_date on public.service_entries(boat_id, service_date);

drop trigger if exists trg_service_entries_updated_at on public.service_entries;
create trigger trg_service_entries_updated_at
before update on public.service_entries
for each row
execute procedure public.handle_updated_at();

-- 3b) haulout_entries ---------------------------------------------------------

create table if not exists public.haulout_entries (
  id                          uuid primary key default gen_random_uuid(),
  boat_id                     uuid not null references public.boats(id) on delete cascade,
  owner_id                    uuid not null,
  haulout_date                date not null,
  launch_date                 date null,
  yard_marina                 text null,
  reason_for_liftout          text null,
  antifoul_brand              text null,
  antifoul_product_name       text null,
  antifoul_type               text null,
  antifoul_colour             text null,
  antifoul_coats              int  null,
  antifoul_last_stripped_blasted boolean null,
  antifoul_applied_by         text null,
  anode_material              text null,
  anodes_replaced             boolean null,
  anode_locations             text null,
  old_anode_condition         text null,
  props_condition             text null,
  props_serviced              text[] null,
  shaft_condition             text null,
  shaft_issues                text null,
  cutless_bearings_checked    text null,
  rudder_steering_checked     text null,
  rudder_steering_issues      text null,
  seacocks_inspected          text null,
  seacocks_replaced           boolean null,
  seacock_material            text null,
  seacocks_issues             text null,
  hull_condition              text null,
  osmosis_check               text null,
  keel_skeg_trim_tabs_checked text null,
  hull_issues                 text null,
  osmosis_notes               text null,
  keel_skeg_trim_tabs_notes   text null,
  yard_contractor_name        text null,
  total_cost                  numeric null,
  general_notes               text null,
  recommendations_next_haulout text null,
  created_at                  timestamptz default timezone('utc', now()),
  updated_at                  timestamptz default timezone('utc', now())
);

create index if not exists idx_haulout_entries_owner_id on public.haulout_entries(owner_id);
create index if not exists idx_haulout_entries_boat_id on public.haulout_entries(boat_id);
create index if not exists idx_haulout_entries_boat_date on public.haulout_entries(boat_id, haulout_date);

drop trigger if exists trg_haulout_entries_updated_at on public.haulout_entries;
create trigger trg_haulout_entries_updated_at
before update on public.haulout_entries
for each row
execute procedure public.handle_updated_at();

-- 4) equipment_items ----------------------------------------------------------

create table if not exists public.equipment_items (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats(id) on delete cascade,
  owner_id     uuid not null,
  category     text not null check (category in ('navigation','safety','other')),
  name         text not null,
  quantity     int not null default 1,
  details      text null,
  expiry_date  date null,
  created_at   timestamptz default timezone('utc', now()),
  updated_at   timestamptz default timezone('utc', now())
);

create index if not exists idx_equipment_items_owner_id on public.equipment_items(owner_id);
create index if not exists idx_equipment_items_boat_id on public.equipment_items(boat_id);
create index if not exists idx_equipment_items_boat_category on public.equipment_items(boat_id, category);

drop trigger if exists trg_equipment_items_updated_at on public.equipment_items;
create trigger trg_equipment_items_updated_at
before update on public.equipment_items
for each row
execute procedure public.handle_updated_at();

-- 5) logbook_entries ----------------------------------------------------------

create table if not exists public.logbook_entries (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats(id) on delete cascade,
  owner_id     uuid not null,
  trip_date    date not null,
  title        text not null,
  notes        text null,
  hours        numeric null,
  from_location text null,
  to_location   text null,
  created_at   timestamptz default timezone('utc', now()),
  updated_at   timestamptz default timezone('utc', now())
);

create index if not exists idx_logbook_entries_owner_id on public.logbook_entries(owner_id);
create index if not exists idx_logbook_entries_boat_id on public.logbook_entries(boat_id);
create index if not exists idx_logbook_entries_boat_trip_date on public.logbook_entries(boat_id, trip_date);

drop trigger if exists trg_logbook_entries_updated_at on public.logbook_entries;
create trigger trg_logbook_entries_updated_at
before update on public.logbook_entries
for each row
execute procedure public.handle_updated_at();

-- 6) attachments --------------------------------------------------------------

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats(id) on delete cascade,
  owner_id     uuid not null,
  entity_type  text not null check (entity_type in ('boat','engine','service','equipment','logbook','haulout')),
  entity_id    uuid null,
  bucket       text not null default 'boatmatey-attachments',
  path         text not null, -- storage object path
  filename     text not null,
  content_type text null,
  size_bytes   bigint null,
  created_at   timestamptz default timezone('utc', now())
);

create index if not exists idx_attachments_owner_id on public.attachments(owner_id);
create index if not exists idx_attachments_boat_id on public.attachments(boat_id);
create index if not exists idx_attachments_entity on public.attachments(entity_type, entity_id);

-- (attachments are append-only; updated_at is not strictly needed)

-- Row Level Security ----------------------------------------------------------

-- Enable RLS on all tables
alter table public.profiles         enable row level security;
alter table public.boats            enable row level security;
alter table public.engines          enable row level security;
alter table public.service_entries  enable row level security;
alter table public.haulout_entries  enable row level security;
alter table public.equipment_items  enable row level security;
alter table public.logbook_entries  enable row level security;
alter table public.attachments      enable row level security;

-- Policies: profiles ----------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own
      on public.profiles
      for insert
      with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_delete_own'
  ) then
    create policy profiles_delete_own
      on public.profiles
      for delete
      using (id = auth.uid());
  end if;
end $$;

-- Helper predicate: boat is owned by current user
create or replace view public.boats_owned_by_current_user as
select b.*
from public.boats b
where b.owner_id = auth.uid();

-- Policies: boats -------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'boats' and policyname = 'boats_select_own'
  ) then
    create policy boats_select_own
      on public.boats
      for select
      using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'boats' and policyname = 'boats_insert_own'
  ) then
    create policy boats_insert_own
      on public.boats
      for insert
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'boats' and policyname = 'boats_update_own'
  ) then
    create policy boats_update_own
      on public.boats
      for update
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'boats' and policyname = 'boats_delete_own'
  ) then
    create policy boats_delete_own
      on public.boats
      for delete
      using (owner_id = auth.uid());
  end if;
end $$;

-- Policies: child tables must belong to current user and their boat ----------

-- engines
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engines' and policyname = 'engines_select_own'
  ) then
    create policy engines_select_own
      on public.engines
      for select
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engines' and policyname = 'engines_insert_own'
  ) then
    create policy engines_insert_own
      on public.engines
      for insert
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engines' and policyname = 'engines_update_own'
  ) then
    create policy engines_update_own
      on public.engines
      for update
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      )
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'engines' and policyname = 'engines_delete_own'
  ) then
    create policy engines_delete_own
      on public.engines
      for delete
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- service_entries
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_entries' and policyname = 'service_entries_select_own'
  ) then
    create policy service_entries_select_own
      on public.service_entries
      for select
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_entries' and policyname = 'service_entries_insert_own'
  ) then
    create policy service_entries_insert_own
      on public.service_entries
      for insert
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_entries' and policyname = 'service_entries_update_own'
  ) then
    create policy service_entries_update_own
      on public.service_entries
      for update
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      )
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_entries' and policyname = 'service_entries_delete_own'
  ) then
    create policy service_entries_delete_own
      on public.service_entries
      for delete
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- haulout_entries
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'haulout_entries' and policyname = 'haulout_entries_select_own'
  ) then
    create policy haulout_entries_select_own
      on public.haulout_entries
      for select
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'haulout_entries' and policyname = 'haulout_entries_insert_own'
  ) then
    create policy haulout_entries_insert_own
      on public.haulout_entries
      for insert
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'haulout_entries' and policyname = 'haulout_entries_update_own'
  ) then
    create policy haulout_entries_update_own
      on public.haulout_entries
      for update
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      )
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'haulout_entries' and policyname = 'haulout_entries_delete_own'
  ) then
    create policy haulout_entries_delete_own
      on public.haulout_entries
      for delete
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- equipment_items
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'equipment_items' and policyname = 'equipment_items_select_own'
  ) then
    create policy equipment_items_select_own
      on public.equipment_items
      for select
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'equipment_items' and policyname = 'equipment_items_insert_own'
  ) then
    create policy equipment_items_insert_own
      on public.equipment_items
      for insert
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'equipment_items' and policyname = 'equipment_items_update_own'
  ) then
    create policy equipment_items_update_own
      on public.equipment_items
      for update
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      )
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'equipment_items' and policyname = 'equipment_items_delete_own'
  ) then
    create policy equipment_items_delete_own
      on public.equipment_items
      for delete
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- logbook_entries
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'logbook_entries' and policyname = 'logbook_entries_select_own'
  ) then
    create policy logbook_entries_select_own
      on public.logbook_entries
      for select
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'logbook_entries' and policyname = 'logbook_entries_insert_own'
  ) then
    create policy logbook_entries_insert_own
      on public.logbook_entries
      for insert
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'logbook_entries' and policyname = 'logbook_entries_update_own'
  ) then
    create policy logbook_entries_update_own
      on public.logbook_entries
      for update
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      )
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'logbook_entries' and policyname = 'logbook_entries_delete_own'
  ) then
    create policy logbook_entries_delete_own
      on public.logbook_entries
      for delete
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- attachments
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attachments' and policyname = 'attachments_select_own'
  ) then
    create policy attachments_select_own
      on public.attachments
      for select
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attachments' and policyname = 'attachments_insert_own'
  ) then
    create policy attachments_insert_own
      on public.attachments
      for insert
      with check (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attachments' and policyname = 'attachments_delete_own'
  ) then
    create policy attachments_delete_own
      on public.attachments
      for delete
      using (
        owner_id = auth.uid()
        and exists (
          select 1 from public.boats b
          where b.id = boat_id and b.owner_id = auth.uid()
        )
      );
  end if;
end $$;

-- Storage bucket and policies -------------------------------------------------

-- Create private bucket for attachments
insert into storage.buckets (id, name, public)
values ('boatmatey-attachments', 'boatmatey-attachments', false)
on conflict (id) do nothing;

-- NOTE: On Supabase, storage.objects is managed by the Storage service and
-- cannot be altered by this script in some environments. RLS is already
-- enabled by default, so we intentionally do NOT alter the table here.

-- Storage policies: only allow authenticated users to access objects in the
-- boatmatey-attachments bucket where the first path segment matches auth.uid().

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boatmatey_attachments_select_own'
  ) then
    create policy boatmatey_attachments_select_own
      on storage.objects
      for select
      using (
        bucket_id = 'boatmatey-attachments'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boatmatey_attachments_insert_own'
  ) then
    create policy boatmatey_attachments_insert_own
      on storage.objects
      for insert
      with check (
        bucket_id = 'boatmatey-attachments'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'boatmatey_attachments_delete_own'
  ) then
    create policy boatmatey_attachments_delete_own
      on storage.objects
      for delete
      using (
        bucket_id = 'boatmatey-attachments'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end $$;

