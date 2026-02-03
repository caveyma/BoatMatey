-- Add reminder_minutes to calendar_events for notification settings.
-- Run in Supabase SQL Editor. Enables "remind me X before" on appointments.
-- reminder_minutes: null = no reminder; 5, 15, 30, 60, 1440 (1 day), 2880 (2 days), 10080 (1 week)

alter table public.calendar_events add column if not exists reminder_minutes int null;

comment on column public.calendar_events.reminder_minutes is 'Minutes before event to trigger reminder; null = none. E.g. 15, 60, 1440 (1 day)';
