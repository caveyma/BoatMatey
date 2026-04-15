-- Central maintenance schedules/reminders model.
-- Keeps reminder management separate from service history logs.

create table if not exists public.maintenance_schedules (
  id                  uuid primary key default gen_random_uuid(),
  boat_id             uuid not null references public.boats(id) on delete cascade,
  owner_id            uuid not null,
  category            text not null default 'General Maintenance',
  linked_entity_type  text null,
  linked_entity_id    uuid null,
  title               text not null,
  notes               text null,
  frequency_type      text not null default 'date',
  frequency_mode      text not null default 'date',
  schedule_type       text not null default 'Custom',
  interval_metadata   jsonb null,
  interval_months     int null,
  interval_hours      int null,
  last_completed_at   date null,
  last_completed_hours numeric null,
  next_due_at         date null,
  next_due_hours      numeric null,
  remind_offset_days  int not null default 7,
  notification_enabled boolean not null default true,
  notification_id     int null,
  is_archived         boolean not null default false,
  created_at          timestamptz default timezone('utc', now()),
  updated_at          timestamptz default timezone('utc', now())
);

create index if not exists idx_maintenance_sched_owner_id on public.maintenance_schedules(owner_id);
create index if not exists idx_maintenance_sched_boat_id on public.maintenance_schedules(boat_id);
create index if not exists idx_maintenance_sched_boat_archived on public.maintenance_schedules(boat_id, is_archived);
create index if not exists idx_maintenance_sched_due_date on public.maintenance_schedules(boat_id, next_due_at);

drop trigger if exists trg_maintenance_sched_updated_at on public.maintenance_schedules;
create trigger trg_maintenance_sched_updated_at
  before update on public.maintenance_schedules
  for each row
  execute procedure public.handle_updated_at();

alter table public.maintenance_schedules enable row level security;

drop policy if exists maintenance_sched_select_own on public.maintenance_schedules;
drop policy if exists maintenance_sched_insert_own on public.maintenance_schedules;
drop policy if exists maintenance_sched_update_own on public.maintenance_schedules;
drop policy if exists maintenance_sched_delete_own on public.maintenance_schedules;

create policy maintenance_sched_select_own on public.maintenance_schedules for select
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy maintenance_sched_insert_own on public.maintenance_schedules for insert
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy maintenance_sched_update_own on public.maintenance_schedules for update
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy maintenance_sched_delete_own on public.maintenance_schedules for delete
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  );
