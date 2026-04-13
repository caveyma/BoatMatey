-- Engine maintenance schedules: planning / due tracking only (separate from service_entries / DIY detail).

create table if not exists public.engine_maintenance_schedules (
  id                            uuid primary key default gen_random_uuid(),
  boat_id                       uuid not null references public.boats(id) on delete cascade,
  engine_id                     uuid not null references public.engines(id) on delete cascade,
  owner_id                      uuid not null,
  task_name                     text not null,
  category                      text null,
  notes                         text null,
  interval_months               int null,
  interval_hours                int null,
  last_completed_date           date null,
  last_completed_engine_hours   numeric null,
  is_active                     boolean not null default true,
  template_key                  text null,
  sort_order                    int null default 0,
  created_at                    timestamptz default timezone('utc', now()),
  updated_at                    timestamptz default timezone('utc', now()),
  constraint engine_maint_sched_interval_chk check (
    (interval_months is not null and interval_months > 0)
    or (interval_hours is not null and interval_hours > 0)
  )
);

create index if not exists idx_engine_maint_sched_owner_id on public.engine_maintenance_schedules(owner_id);
create index if not exists idx_engine_maint_sched_boat_id on public.engine_maintenance_schedules(boat_id);
create index if not exists idx_engine_maint_sched_engine_id on public.engine_maintenance_schedules(engine_id);
create index if not exists idx_engine_maint_sched_boat_active on public.engine_maintenance_schedules(boat_id, is_active);

drop trigger if exists trg_engine_maint_sched_updated_at on public.engine_maintenance_schedules;
create trigger trg_engine_maint_sched_updated_at
  before update on public.engine_maintenance_schedules
  for each row
  execute procedure public.handle_updated_at();

alter table public.engine_maintenance_schedules enable row level security;

drop policy if exists engine_maint_sched_select_own on public.engine_maintenance_schedules;
drop policy if exists engine_maint_sched_insert_own on public.engine_maintenance_schedules;
drop policy if exists engine_maint_sched_update_own on public.engine_maintenance_schedules;
drop policy if exists engine_maint_sched_delete_own on public.engine_maintenance_schedules;

create policy engine_maint_sched_select_own on public.engine_maintenance_schedules for select
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.engines e
      join public.boats b on b.id = e.boat_id
      where e.id = engine_maintenance_schedules.engine_id
        and e.boat_id = engine_maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy engine_maint_sched_insert_own on public.engine_maintenance_schedules for insert
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.engines e
      join public.boats b on b.id = e.boat_id
      where e.id = engine_id
        and e.boat_id = boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy engine_maint_sched_update_own on public.engine_maintenance_schedules for update
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.engines e
      join public.boats b on b.id = e.boat_id
      where e.id = engine_maintenance_schedules.engine_id
        and e.boat_id = engine_maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.engines e
      join public.boats b on b.id = e.boat_id
      where e.id = engine_id
        and e.boat_id = boat_id
        and b.owner_id = (select auth.uid())
    )
  );

create policy engine_maint_sched_delete_own on public.engine_maintenance_schedules for delete
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.engines e
      join public.boats b on b.id = e.boat_id
      where e.id = engine_maintenance_schedules.engine_id
        and e.boat_id = engine_maintenance_schedules.boat_id
        and b.owner_id = (select auth.uid())
    )
  );
