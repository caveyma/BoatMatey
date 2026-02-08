-- Grant active lifetime subscription to specific accounts.
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Matches by profiles.email so both rows are updated.

update public.profiles
set
  subscription_status = 'active',
  subscription_plan = 'BoatMatey Lifetime',
  subscription_expires_at = null,
  updated_at = timezone('utc', now())
where email in (
  'martincavey@gmail.com',
  'reviewer@boatmatey.com'
);
