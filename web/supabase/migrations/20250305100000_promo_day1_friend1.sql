-- Add 1-day promo type and create Friend1 code (1 day free trial).

-- Allow promo_type 'day_1' in promo_codes
alter table public.promo_codes
  drop constraint if exists promo_codes_promo_type_check;

alter table public.promo_codes
  add constraint promo_codes_promo_type_check
  check (promo_type in ('day_1', 'month_1', 'month_12', 'lifetime'));

-- Insert Friend1: 1 day free trial (adjust max_uses/starts_at/expires_at as needed)
insert into public.promo_codes (code, promo_type, max_uses, notes, starts_at, expires_at)
values (
  'Friend1',
  'day_1',
  1000,
  '1 day free trial',
  now(),
  now() + interval '2 years'
)
on conflict (code) do nothing;
