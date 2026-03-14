-- Passage Log: support multi-day passages (hours to many days) and motor/sail
-- Add end date and optional passage type to logbook_entries

alter table public.logbook_entries
  add column if not exists trip_date_end date null,
  add column if not exists passage_type text null;

comment on column public.logbook_entries.trip_date_end is 'End date of passage; null means same-day or short passage';
comment on column public.logbook_entries.passage_type is 'motor | sail | both';

create index if not exists idx_logbook_entries_boat_trip_date_end
  on public.logbook_entries(boat_id, trip_date_end) where trip_date_end is not null;
