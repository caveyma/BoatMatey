-- Add next_haulout_reminder_minutes to haulout_entries.
-- Enables configurable reminder timing (default 1 day before).
-- Run in Supabase SQL Editor.

alter table public.haulout_entries add column if not exists next_haulout_reminder_minutes int null;

comment on column public.haulout_entries.next_haulout_reminder_minutes is 'Minutes before next_haulout_due to trigger reminder; null = use default (1440)';
