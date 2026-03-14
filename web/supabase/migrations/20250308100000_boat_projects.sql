-- Boat projects: planned or in-progress upgrades/refit (not completed maintenance history).
-- Belongs to a boat; supports status, priority, category, costs, target/completed dates, notes.

create table if not exists public.boat_projects (
  id                        uuid primary key default gen_random_uuid(),
  boat_id                   uuid not null references public.boats(id) on delete cascade,
  owner_id                  uuid not null,
  project_name              text not null,
  category                  text null check (category in (
    'Electronics','Mechanical','Plumbing','Electrical','Hull / Deck','Interior','Safety','Other'
  )),
  description               text null,
  status                    text null check (status in (
    'Idea','Planning','Parts Ordered','Scheduled','In Progress','Completed','Cancelled'
  )),
  priority                  text null check (priority in ('Low','Medium','High')),
  target_date               date null,
  completed_date            date null,
  estimated_cost            numeric null,
  estimated_cost_currency   text null default 'GBP',
  actual_cost               numeric null,
  actual_cost_currency      text null default 'GBP',
  supplier_installer        text null,
  notes                     text null,
  created_at                timestamptz default timezone('utc', now()),
  updated_at                timestamptz default timezone('utc', now())
);

create index if not exists idx_boat_projects_owner_id on public.boat_projects(owner_id);
create index if not exists idx_boat_projects_boat_id on public.boat_projects(boat_id);
create index if not exists idx_boat_projects_boat_status on public.boat_projects(boat_id, status);
create index if not exists idx_boat_projects_target_date on public.boat_projects(target_date);

drop trigger if exists trg_boat_projects_updated_at on public.boat_projects;
create trigger trg_boat_projects_updated_at
  before update on public.boat_projects
  for each row
  execute procedure public.handle_updated_at();

alter table public.boat_projects enable row level security;

-- RLS: same pattern as haulout_entries (initPlan-friendly)
drop policy if exists boat_projects_select_own on public.boat_projects;
drop policy if exists boat_projects_insert_own on public.boat_projects;
drop policy if exists boat_projects_update_own on public.boat_projects;
drop policy if exists boat_projects_delete_own on public.boat_projects;

create policy boat_projects_select_own on public.boat_projects for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

create policy boat_projects_insert_own on public.boat_projects for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

create policy boat_projects_update_own on public.boat_projects for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

create policy boat_projects_delete_own on public.boat_projects for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
