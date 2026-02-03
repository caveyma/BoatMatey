-- BoatMatey teardown: remove all schema objects created by boatmatey_setup.sql
-- Run this in the Supabase SQL Editor on the project where you ran the setup by mistake.
-- Uses IF EXISTS so it's safe if only some objects were created.
-- CASCADE will also drop any views or policies that depend on these tables (e.g. public_lost_pets_view).

-- 1) Drop view (depends on boats)
drop view if exists public.boats_owned_by_current_user;

-- 2) Drop tables (CASCADE drops views/policies that depend on these, e.g. public_lost_pets_view)
drop table if exists public.attachments cascade;
drop table if exists public.logbook_entries cascade;
drop table if exists public.equipment_items cascade;
drop table if exists public.haulout_entries cascade;
drop table if exists public.service_entries cascade;
drop table if exists public.engines cascade;
drop table if exists public.boats cascade;
drop table if exists public.profiles cascade;

-- 3) Drop storage policies on storage.objects (BoatMatey bucket)
drop policy if exists boatmatey_attachments_select_own on storage.objects;
drop policy if exists boatmatey_attachments_insert_own on storage.objects;
drop policy if exists boatmatey_attachments_delete_own on storage.objects;

-- 4) Remove the storage bucket (fails if bucket has files; empty it in Dashboard > Storage first if needed)
delete from storage.buckets where id = 'boatmatey-attachments';

-- 5) Drop helper function
drop function if exists public.handle_updated_at();
