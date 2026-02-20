-- Fix "Auth RLS Initialization Plan" Performance Advisor warnings:
-- Replace auth.uid()/auth.role() with (select auth.uid())/(select auth.role())
-- so the planner evaluates them once per query (initPlan) instead of per row.
-- Run this on existing databases that already have the old policies.

-- Profiles
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete using (id = (select auth.uid()));

-- Boats
drop policy if exists boats_select_own on public.boats;
drop policy if exists boats_insert_own on public.boats;
drop policy if exists boats_update_own on public.boats;
drop policy if exists boats_delete_own on public.boats;
create policy boats_select_own on public.boats for select using (owner_id = (select auth.uid()));
create policy boats_insert_own on public.boats for insert with check (owner_id = (select auth.uid()));
create policy boats_update_own on public.boats for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy boats_delete_own on public.boats for delete using (owner_id = (select auth.uid()));

-- View used by RLS/helpers (security_invoker so Security Advisor does not flag it)
create or replace view public.boats_owned_by_current_user with (security_invoker = true) as
select b.* from public.boats b where b.owner_id = (select auth.uid());

-- Engines
drop policy if exists engines_select_own on public.engines;
drop policy if exists engines_insert_own on public.engines;
drop policy if exists engines_update_own on public.engines;
drop policy if exists engines_delete_own on public.engines;
create policy engines_select_own on public.engines for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy engines_insert_own on public.engines for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy engines_update_own on public.engines for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy engines_delete_own on public.engines for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

-- Service entries
drop policy if exists service_entries_select_own on public.service_entries;
drop policy if exists service_entries_insert_own on public.service_entries;
drop policy if exists service_entries_update_own on public.service_entries;
drop policy if exists service_entries_delete_own on public.service_entries;
create policy service_entries_select_own on public.service_entries for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy service_entries_insert_own on public.service_entries for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy service_entries_update_own on public.service_entries for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy service_entries_delete_own on public.service_entries for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

-- Haulout entries
drop policy if exists haulout_entries_select_own on public.haulout_entries;
drop policy if exists haulout_entries_insert_own on public.haulout_entries;
drop policy if exists haulout_entries_update_own on public.haulout_entries;
drop policy if exists haulout_entries_delete_own on public.haulout_entries;
create policy haulout_entries_select_own on public.haulout_entries for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy haulout_entries_insert_own on public.haulout_entries for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy haulout_entries_update_own on public.haulout_entries for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy haulout_entries_delete_own on public.haulout_entries for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

-- Equipment items
drop policy if exists equipment_items_select_own on public.equipment_items;
drop policy if exists equipment_items_insert_own on public.equipment_items;
drop policy if exists equipment_items_update_own on public.equipment_items;
drop policy if exists equipment_items_delete_own on public.equipment_items;
create policy equipment_items_select_own on public.equipment_items for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy equipment_items_insert_own on public.equipment_items for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy equipment_items_update_own on public.equipment_items for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy equipment_items_delete_own on public.equipment_items for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

-- Logbook entries
drop policy if exists logbook_entries_select_own on public.logbook_entries;
drop policy if exists logbook_entries_insert_own on public.logbook_entries;
drop policy if exists logbook_entries_update_own on public.logbook_entries;
drop policy if exists logbook_entries_delete_own on public.logbook_entries;
create policy logbook_entries_select_own on public.logbook_entries for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy logbook_entries_insert_own on public.logbook_entries for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy logbook_entries_update_own on public.logbook_entries for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy logbook_entries_delete_own on public.logbook_entries for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

-- Attachments
drop policy if exists attachments_select_own on public.attachments;
drop policy if exists attachments_insert_own on public.attachments;
drop policy if exists attachments_delete_own on public.attachments;
create policy attachments_select_own on public.attachments for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy attachments_insert_own on public.attachments for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
create policy attachments_delete_own on public.attachments for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

-- Calendar events (only if table exists)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'calendar_events') then
    drop policy if exists calendar_events_select_own on public.calendar_events;
    drop policy if exists calendar_events_insert_own on public.calendar_events;
    drop policy if exists calendar_events_update_own on public.calendar_events;
    drop policy if exists calendar_events_delete_own on public.calendar_events;
    create policy calendar_events_select_own on public.calendar_events for select using (owner_id = (select auth.uid()));
    create policy calendar_events_insert_own on public.calendar_events for insert with check (owner_id = (select auth.uid()));
    create policy calendar_events_update_own on public.calendar_events for update using (owner_id = (select auth.uid()));
    create policy calendar_events_delete_own on public.calendar_events for delete using (owner_id = (select auth.uid()));
  end if;
end $$;

-- Boat fuel/electrical/batteries (only if tables exist)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'boat_fuel_logs') then
    drop policy if exists boat_fuel_logs_select_own on public.boat_fuel_logs;
    drop policy if exists boat_fuel_logs_insert_own on public.boat_fuel_logs;
    drop policy if exists boat_fuel_logs_update_own on public.boat_fuel_logs;
    drop policy if exists boat_fuel_logs_delete_own on public.boat_fuel_logs;
    create policy boat_fuel_logs_select_own on public.boat_fuel_logs for select
      using (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_fuel_logs_insert_own on public.boat_fuel_logs for insert
      with check (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_fuel_logs_update_own on public.boat_fuel_logs for update
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy boat_fuel_logs_delete_own on public.boat_fuel_logs for delete
      using (user_id = (select auth.uid()));
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'boat_fuel_performance') then
    drop policy if exists boat_fuel_performance_select_own on public.boat_fuel_performance;
    drop policy if exists boat_fuel_performance_insert_own on public.boat_fuel_performance;
    drop policy if exists boat_fuel_performance_update_own on public.boat_fuel_performance;
    drop policy if exists boat_fuel_performance_delete_own on public.boat_fuel_performance;
    create policy boat_fuel_performance_select_own on public.boat_fuel_performance for select using (user_id = (select auth.uid()));
    create policy boat_fuel_performance_insert_own on public.boat_fuel_performance for insert
      with check (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_fuel_performance_update_own on public.boat_fuel_performance for update
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy boat_fuel_performance_delete_own on public.boat_fuel_performance for delete
      using (user_id = (select auth.uid()));
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'boat_electrical') then
    drop policy if exists boat_electrical_select_own on public.boat_electrical;
    drop policy if exists boat_electrical_insert_own on public.boat_electrical;
    drop policy if exists boat_electrical_update_own on public.boat_electrical;
    drop policy if exists boat_electrical_delete_own on public.boat_electrical;
    create policy boat_electrical_select_own on public.boat_electrical for select using (user_id = (select auth.uid()));
    create policy boat_electrical_insert_own on public.boat_electrical for insert
      with check (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_electrical_update_own on public.boat_electrical for update
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy boat_electrical_delete_own on public.boat_electrical for delete
      using (user_id = (select auth.uid()));
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'boat_batteries') then
    drop policy if exists boat_batteries_select_own on public.boat_batteries;
    drop policy if exists boat_batteries_insert_own on public.boat_batteries;
    drop policy if exists boat_batteries_update_own on public.boat_batteries;
    drop policy if exists boat_batteries_delete_own on public.boat_batteries;
    create policy boat_batteries_select_own on public.boat_batteries for select
      using (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_batteries_insert_own on public.boat_batteries for insert
      with check (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_batteries_update_own on public.boat_batteries for update
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy boat_batteries_delete_own on public.boat_batteries for delete
      using (user_id = (select auth.uid()));
  end if;
end $$;

-- Boat distress info (only if table exists)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'boat_distress_info') then
    drop policy if exists boat_distress_info_select_own on public.boat_distress_info;
    drop policy if exists boat_distress_info_insert_own on public.boat_distress_info;
    drop policy if exists boat_distress_info_update_own on public.boat_distress_info;
    drop policy if exists boat_distress_info_delete_own on public.boat_distress_info;
    create policy boat_distress_info_select_own on public.boat_distress_info for select using (user_id = (select auth.uid()));
    create policy boat_distress_info_insert_own on public.boat_distress_info for insert
      with check (user_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_distress_info_update_own on public.boat_distress_info for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
    create policy boat_distress_info_delete_own on public.boat_distress_info for delete using (user_id = (select auth.uid()));
  end if;
end $$;

-- Boat links (only if table exists)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'boat_links') then
    drop policy if exists boat_links_select_own on public.boat_links;
    drop policy if exists boat_links_insert_own on public.boat_links;
    drop policy if exists boat_links_update_own on public.boat_links;
    drop policy if exists boat_links_delete_own on public.boat_links;
    create policy boat_links_select_own on public.boat_links for select
      using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
    create policy boat_links_insert_own on public.boat_links for insert
      with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid()) and b.status = 'active'));
    create policy boat_links_update_own on public.boat_links for update
      using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid()) and b.status = 'active'))
      with check (owner_id = (select auth.uid()));
    create policy boat_links_delete_own on public.boat_links for delete
      using (owner_id = (select auth.uid()));
  end if;
end $$;

-- Storage bucket policies
drop policy if exists boatmatey_attachments_select_own on storage.objects;
drop policy if exists boatmatey_attachments_insert_own on storage.objects;
drop policy if exists boatmatey_attachments_delete_own on storage.objects;
create policy boatmatey_attachments_select_own on storage.objects for select
  using (bucket_id = 'boatmatey-attachments' and (select auth.role()) = 'authenticated' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy boatmatey_attachments_insert_own on storage.objects for insert
  with check (bucket_id = 'boatmatey-attachments' and (select auth.role()) = 'authenticated' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy boatmatey_attachments_delete_own on storage.objects for delete
  using (bucket_id = 'boatmatey-attachments' and (select auth.role()) = 'authenticated' and split_part(name, '/', 1) = (select auth.uid())::text);
