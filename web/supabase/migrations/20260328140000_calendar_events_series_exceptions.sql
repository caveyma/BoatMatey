-- Recurring calendar: per-occurrence delete/edit (PetHub+-style) via exceptions and overrides.
alter table public.calendar_events
  add column if not exists exception_dates jsonb not null default '[]'::jsonb,
  add column if not exists occurrence_overrides jsonb not null default '{}'::jsonb;

comment on column public.calendar_events.exception_dates is
  'JSON array of ISO date strings (YYYY-MM-DD) to omit when expanding repeats (single-occurrence deletes).';
comment on column public.calendar_events.occurrence_overrides is
  'JSON object keyed by ISO date; values may include title, time, notes, reminder_minutes for that occurrence only.';
