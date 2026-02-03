-- Optional: add watermaker fields to boats table
-- Run this in Supabase SQL editor after deploying to enable cloud sync.

alter table public.boats
  add column if not exists watermaker_installed boolean default false;

alter table public.boats
  add column if not exists watermaker_data jsonb;

