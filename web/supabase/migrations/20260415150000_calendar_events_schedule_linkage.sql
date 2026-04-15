-- Link calendar_events rows to maintenance schedules and prevent duplicates.

alter table public.calendar_events
  add column if not exists type text not null default 'appointment',
  add column if not exists schedule_id uuid null references public.maintenance_schedules(id) on delete cascade;

create index if not exists idx_calendar_events_schedule_id
  on public.calendar_events(schedule_id);

create unique index if not exists uq_calendar_events_maintenance_schedule
  on public.calendar_events(schedule_id)
  where schedule_id is not null and type = 'maintenance_schedule';
