-- Add next_haulout_due to haulout_entries (if table exists) and create calendar_events table.
-- Run in Supabase SQL Editor. Requires public.boats (from boatmatey_setup.sql).
-- If haulout_entries does not exist yet, run boatmatey_setup.sql first for full schema.

-- 1) next_haulout_due on haulout_entries (only if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'haulout_entries') then
    alter table public.haulout_entries add column if not exists next_haulout_due date null;
  end if;
end $$;

-- 2) calendar_events for Calendar & Alerts
create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats(id) on delete cascade,
  owner_id     uuid not null,
  date         date not null,
  time         time null,
  title        text not null,
  notes        text null,
  repeat       text null,
  repeat_until  date null,
  created_at   timestamptz default timezone('utc', now()),
  updated_at   timestamptz default timezone('utc', now())
);

create index if not exists idx_calendar_events_boat_id on public.calendar_events(boat_id);
create index if not exists idx_calendar_events_owner_id on public.calendar_events(owner_id);
create index if not exists idx_calendar_events_date on public.calendar_events(date);

alter table public.calendar_events enable row level security;

drop trigger if exists trg_calendar_events_updated_at on public.calendar_events;
create trigger trg_calendar_events_updated_at
before update on public.calendar_events
for each row
execute procedure public.handle_updated_at();

-- RLS policies for calendar_events
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'calendar_events_select_own') then
    create policy calendar_events_select_own on public.calendar_events for select using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'calendar_events_insert_own') then
    create policy calendar_events_insert_own on public.calendar_events for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'calendar_events_update_own') then
    create policy calendar_events_update_own on public.calendar_events for update using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'calendar_events' and policyname = 'calendar_events_delete_own') then
    create policy calendar_events_delete_own on public.calendar_events for delete using (owner_id = auth.uid());
  end if;
end $$;
