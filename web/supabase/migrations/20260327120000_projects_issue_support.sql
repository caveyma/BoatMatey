-- Extend boat_projects to support both projects and issues in one table.
-- Backward compatibility: existing rows default to type = 'Project'.

alter table public.boat_projects
  add column if not exists type text,
  add column if not exists reported_by text,
  add column if not exists date_reported date,
  add column if not exists severity text,
  add column if not exists archived_at timestamptz;

update public.boat_projects
set type = 'Project'
where type is null;

update public.boat_projects
set status = case
  when status in ('Idea', 'Planning', 'Parts Ordered', 'Scheduled') then 'Planned'
  when status = 'Cancelled' then 'Closed'
  else status
end
where status in ('Idea', 'Planning', 'Parts Ordered', 'Scheduled', 'Cancelled');

alter table public.boat_projects
  alter column type set default 'Project';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'boat_projects_type_check'
      and conrelid = 'public.boat_projects'::regclass
  ) then
    alter table public.boat_projects drop constraint boat_projects_type_check;
  end if;
end $$;

alter table public.boat_projects
  add constraint boat_projects_type_check
  check (type in ('Project', 'Issue'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'boat_projects_status_check'
      and conrelid = 'public.boat_projects'::regclass
  ) then
    alter table public.boat_projects drop constraint boat_projects_status_check;
  end if;
end $$;

alter table public.boat_projects
  add constraint boat_projects_status_check
  check (
    status is null
    or status in (
      'Planned',
      'In Progress',
      'Completed',
      'Open',
      'Under Review',
      'Waiting Parts',
      'Resolved',
      'Closed'
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'boat_projects_severity_check'
      and conrelid = 'public.boat_projects'::regclass
  ) then
    alter table public.boat_projects drop constraint boat_projects_severity_check;
  end if;
end $$;

alter table public.boat_projects
  add constraint boat_projects_severity_check
  check (severity is null or severity in ('Low', 'Medium', 'High', 'Critical'));

create index if not exists idx_boat_projects_archived_at on public.boat_projects(archived_at);
