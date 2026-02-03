-- Boat type (motor vs sailing) and sails/rigging data for sailing boats
-- Run after boatmatey_setup.sql and boat_limits_and_archive.sql.

-- 1) boats.boat_type ---------------------------------------------------------
alter table public.boats
  add column if not exists boat_type text not null default 'motor'
  check (boat_type in ('motor', 'sailing'));

comment on column public.boats.boat_type is 'motor = power boat; sailing = sailboat (shows Sails & Rigging card and service type)';

-- 2) boats.sails_rigging_data (JSONB for sailing boat details) ---------------
alter table public.boats
  add column if not exists sails_rigging_data jsonb default null;

comment on column public.boats.sails_rigging_data is 'Sailing boats only: mainsail, headsails, mast, rigging notes, last service, etc.';
