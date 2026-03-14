-- Ensure FRIEND1 exists and is valid for validation/redemption (idempotent).
-- Fixes "Invalid promo code" when the row was missing or had wrong case/dates.

-- Normalize any existing friend1 row to FRIEND1 and ensure valid dates/flags
update public.promo_codes
set
  code = 'FRIEND1',
  is_active = true,
  allow_multiple_per_user = true,
  starts_at = least(starts_at, now() - interval '1 day'),
  expires_at = greatest(expires_at, now() + interval '2 years'),
  max_uses = greatest(max_uses, 10000)
where lower(code) = 'friend1';

-- Insert FRIEND1 if no row exists yet
insert into public.promo_codes (
  code, promo_type, max_uses, uses, is_active, allow_multiple_per_user,
  starts_at, expires_at, notes
)
select
  'FRIEND1', 'day_1', 10000, 0, true, true,
  now() - interval '1 day', now() + interval '2 years', '1 day free trial (testing)'
where not exists (select 1 from public.promo_codes where code = 'FRIEND1');
