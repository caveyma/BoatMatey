-- Add RLS policy for webhook_logs so Security Advisor no longer reports "RLS Enabled No Policy".
-- Table is only used by the Edge Function (service role), which bypasses RLS.
-- This policy denies all access for anon/authenticated; service role can still read/write.

drop policy if exists "webhook_logs_service_only" on public.webhook_logs;

create policy "webhook_logs_service_only"
  on public.webhook_logs
  for all
  using (false)
  with check (false);
