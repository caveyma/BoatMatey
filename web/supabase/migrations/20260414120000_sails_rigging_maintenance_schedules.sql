-- Sails & rigging maintenance schedules: calendar-month planning only (no engine hours).

create table if not exists public.sails_rigging_maintenance_schedules (
  id                  uuid primary key default gen_random_uuid(),
  boat_id             uuid not null references public.boats(id) on delete cascade,
  owner_id            uuid not null,
  task_name           text not null,
  category            text null,
  notes               text null,
  interval_months     int not null,
  last_completed_date date null,
  is_active           boolean not null default true,
  template_key        text null,
  sort_order          int null default 0,
  created_at          timestamptz default timezone('utc', now()),
  updated_at          timestamptz default timezone('utc', now()),
  constraint sails_rig_maint_interval_chk check (interval_months > 0)
);

create index if not exists idx_sails_rig_maint_owner_id on public.sails_rigging_maintenance_schedules(owner_id);
create index if not exists idx_sails_rig_maint_boat_id on public.sails_rigging_maintenance_schedules(boat_id);
create index if not exists idx_sails_rig_maint_boat_active on public.sails_rigging_maintenance_schedules(boat_id, is_active);

drop trigger if exists trg_sails_rig_maint_updated_at on public.sails_rigging_maintenance_schedules;
create trigger trg_sails_rig_maint_updated_at
  before update on public.sails_rigging_maintenance_schedules
  for each row
  execute procedure public.handle_updated_at();

alter table public.sails_rigging_maintenance_schedules enable row level security;

drop policy if exists sails_rig_maint_sched_select_own on public.sails_rigging_maintenance_schedules;
drop policy if exists sails_rig_maint_sched_insert_own on public.sails_rigging_maintenance_schedules;
drop policy if exists sails_rig_maint_sched_update_own on public.sails_rigging_maintenance_schedules;
drop policy if exists sails_rig_maint_sched_delete_own on public.sails_rigging_maintenance_schedules;

create policy sails_rig_maint_sched_select_own on public.sails_rigging_maintenance_schedules for select
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = sails_rigging_maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy sails_rig_maint_sched_insert_own on public.sails_rigging_maintenance_schedules for insert
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy sails_rig_maint_sched_update_own on public.sails_rigging_maintenance_schedules for update
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = sails_rigging_maintenance_schedules.boat_id
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

create policy sails_rig_maint_sched_delete_own on public.sails_rigging_maintenance_schedules for delete
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.boats b
      where b.id = sails_rigging_maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  );
