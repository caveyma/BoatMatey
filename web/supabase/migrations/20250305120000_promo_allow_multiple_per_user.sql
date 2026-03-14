-- Allow promo codes to be redeemed multiple times by the same user (for testing / top-up).
-- When true: same user can redeem again; profile and redemption row are updated (access extended).

alter table public.promo_codes
  add column if not exists allow_multiple_per_user boolean not null default false;

-- FRIEND1: ensure uppercase and allow same user to redeem repeatedly for testing
update public.promo_codes
set code = 'FRIEND1', allow_multiple_per_user = true
where lower(code) = 'friend1';
