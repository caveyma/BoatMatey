-- Allow "rib" as a valid boats.boat_type value.
-- Handles both historical constraint names.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'boats_boat_type_check'
  ) then
    alter table public.boats drop constraint boats_boat_type_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'boats_data_type_check'
  ) then
    alter table public.boats drop constraint boats_data_type_check;
  end if;
end $$;

alter table public.boats
  add constraint boats_boat_type_check
  check (boat_type in ('motor', 'sailing', 'rib'));
