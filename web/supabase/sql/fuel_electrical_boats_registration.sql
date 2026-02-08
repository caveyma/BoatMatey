-- Fuel & Performance, Electrical & Batteries, and Boat Registration/Compliance
-- Run after boatmatey_setup.sql. Creates new tables, extends boats, RLS, indexes.
-- Same as migrations/20250208000000_fuel_electrical_boats_registration.sql

-- =============================================================================
-- A) boat_fuel_logs
-- =============================================================================
create table if not exists public.boat_fuel_logs (
  id                  uuid primary key default gen_random_uuid(),
  boat_id             uuid not null references public.boats(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  log_date            date not null,
  engine_hours        numeric(10,1) null,
  fuel_added_litres   numeric(10,1) null,
  fuel_cost           numeric(10,2) null,
  fuel_price_per_litre numeric(10,3) generated always as (
    case when fuel_added_litres > 0 then fuel_cost / fuel_added_litres else null end
  ) stored,
  distance_nm         numeric(10,1) null,
  avg_speed_kn        numeric(10,1) null,
  notes               text null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_boat_fuel_logs_boat_date on public.boat_fuel_logs(boat_id, log_date desc);

drop trigger if exists trg_boat_fuel_logs_updated_at on public.boat_fuel_logs;
create trigger trg_boat_fuel_logs_updated_at
  before update on public.boat_fuel_logs
  for each row
  execute procedure public.handle_updated_at();

-- =============================================================================
-- B) boat_fuel_performance (one row per boat)
-- =============================================================================
create table if not exists public.boat_fuel_performance (
  boat_id                 uuid primary key references public.boats(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  preferred_units         text not null default 'litres',
  typical_cruise_rpm      integer null,
  typical_cruise_speed_kn numeric(10,1) null,
  typical_burn_lph        numeric(10,1) null,
  fuel_tank_capacity_litres numeric(10,1) null,
  usable_fuel_litres      numeric(10,1) null,
  notes                   text null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_boat_fuel_performance_user_id on public.boat_fuel_performance(user_id);

drop trigger if exists trg_boat_fuel_performance_updated_at on public.boat_fuel_performance;
create trigger trg_boat_fuel_performance_updated_at
  before update on public.boat_fuel_performance
  for each row
  execute procedure public.handle_updated_at();

-- =============================================================================
-- C) boat_electrical (one row per boat)
-- =============================================================================
create table if not exists public.boat_electrical (
  boat_id           uuid primary key references public.boats(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  system_voltage    integer null,
  shore_power       boolean null,
  inverter          boolean null,
  inverter_brand    text null,
  charger_brand     text null,
  solar             boolean null,
  solar_watts       integer null,
  generator         boolean null,
  generator_brand   text null,
  notes             text null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_boat_electrical_user_id on public.boat_electrical(user_id);

drop trigger if exists trg_boat_electrical_updated_at on public.boat_electrical;
create trigger trg_boat_electrical_updated_at
  before update on public.boat_electrical
  for each row
  execute procedure public.handle_updated_at();

-- =============================================================================
-- D) boat_batteries (multiple per boat)
-- =============================================================================
create table if not exists public.boat_batteries (
  id                uuid primary key default gen_random_uuid(),
  boat_id           uuid not null references public.boats(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  battery_name      text not null,
  battery_type      text null,
  capacity_ah       integer null,
  quantity          integer not null default 1,
  installed_date    date null,
  last_test_date    date null,
  last_test_notes   text null,
  replaced_date     date null,
  notes             text null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_boat_batteries_boat_id on public.boat_batteries(boat_id);

drop trigger if exists trg_boat_batteries_updated_at on public.boat_batteries;
create trigger trg_boat_batteries_updated_at
  before update on public.boat_batteries
  for each row
  execute procedure public.handle_updated_at();

-- =============================================================================
-- E) Extend boats table (Registration & Compliance)
-- =============================================================================
alter table public.boats add column if not exists registration_number text null;
alter table public.boats add column if not exists ssr_number text null;
alter table public.boats add column if not exists vhf_callsign text null;
alter table public.boats add column if not exists vhf_mmsi text null;
alter table public.boats add column if not exists last_survey_date date null;
alter table public.boats add column if not exists last_surveyor text null;
alter table public.boats add column if not exists last_survey_notes text null;
alter table public.boats add column if not exists home_port text null;
alter table public.boats add column if not exists fuel_type text null;
alter table public.boats add column if not exists home_marina text null;
alter table public.boats add column if not exists registration_no text null;
alter table public.boats add column if not exists insurance_provider text null;
alter table public.boats add column if not exists insurance_policy_no text null;
alter table public.boats add column if not exists purchase_date date null;

-- =============================================================================
-- RLS: Enable and policies (user_id = auth.uid() and boat ownership)
-- =============================================================================
alter table public.boat_fuel_logs       enable row level security;
alter table public.boat_fuel_performance enable row level security;
alter table public.boat_electrical       enable row level security;
alter table public.boat_batteries        enable row level security;

-- boat_fuel_logs
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_logs' and policyname = 'boat_fuel_logs_select_own') then
    create policy boat_fuel_logs_select_own on public.boat_fuel_logs for select
      using (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_logs' and policyname = 'boat_fuel_logs_insert_own') then
    create policy boat_fuel_logs_insert_own on public.boat_fuel_logs for insert
      with check (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_logs' and policyname = 'boat_fuel_logs_update_own') then
    create policy boat_fuel_logs_update_own on public.boat_fuel_logs for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_logs' and policyname = 'boat_fuel_logs_delete_own') then
    create policy boat_fuel_logs_delete_own on public.boat_fuel_logs for delete
      using (user_id = auth.uid());
  end if;
end $$;

-- boat_fuel_performance
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_performance' and policyname = 'boat_fuel_performance_select_own') then
    create policy boat_fuel_performance_select_own on public.boat_fuel_performance for select
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_performance' and policyname = 'boat_fuel_performance_insert_own') then
    create policy boat_fuel_performance_insert_own on public.boat_fuel_performance for insert
      with check (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_performance' and policyname = 'boat_fuel_performance_update_own') then
    create policy boat_fuel_performance_update_own on public.boat_fuel_performance for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_fuel_performance' and policyname = 'boat_fuel_performance_delete_own') then
    create policy boat_fuel_performance_delete_own on public.boat_fuel_performance for delete
      using (user_id = auth.uid());
  end if;
end $$;

-- boat_electrical
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_electrical' and policyname = 'boat_electrical_select_own') then
    create policy boat_electrical_select_own on public.boat_electrical for select
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_electrical' and policyname = 'boat_electrical_insert_own') then
    create policy boat_electrical_insert_own on public.boat_electrical for insert
      with check (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_electrical' and policyname = 'boat_electrical_update_own') then
    create policy boat_electrical_update_own on public.boat_electrical for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_electrical' and policyname = 'boat_electrical_delete_own') then
    create policy boat_electrical_delete_own on public.boat_electrical for delete
      using (user_id = auth.uid());
  end if;
end $$;

-- boat_batteries
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_batteries' and policyname = 'boat_batteries_select_own') then
    create policy boat_batteries_select_own on public.boat_batteries for select
      using (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_batteries' and policyname = 'boat_batteries_insert_own') then
    create policy boat_batteries_insert_own on public.boat_batteries for insert
      with check (user_id = auth.uid() and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_batteries' and policyname = 'boat_batteries_update_own') then
    create policy boat_batteries_update_own on public.boat_batteries for update
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'boat_batteries' and policyname = 'boat_batteries_delete_own') then
    create policy boat_batteries_delete_own on public.boat_batteries for delete
      using (user_id = auth.uid());
  end if;
end $$;
