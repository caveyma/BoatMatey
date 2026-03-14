-- Add next_haulout_due and next_haulout_reminder_minutes to haulout_entries
-- so the Edit Haul-Out form can persist "Next haul-out due" and reminder settings.
-- Only runs if public.haulout_entries exists (no error if the table is not created yet).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'haulout_entries'
  ) then
    alter table public.haulout_entries add column if not exists next_haulout_due date null;
    alter table public.haulout_entries add column if not exists next_haulout_reminder_minutes int null;
    comment on column public.haulout_entries.next_haulout_due is 'Suggested date for next haul-out; shown on Calendar for reminders.';
    comment on column public.haulout_entries.next_haulout_reminder_minutes is 'Minutes before next_haulout_due to trigger reminder; null = use default (1440).';
  end if;
end $$;
