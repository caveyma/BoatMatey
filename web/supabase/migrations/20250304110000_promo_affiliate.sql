-- Promo + affiliate attribution + commissions + derived access fields.
-- Profiles already have promo_access_until, promo_source from 20250302110000_promo_codes.
-- Add: affiliate_code, affiliate_assigned_at, access_until, is_active.
-- Add: affiliate_commissions table for commission tracking (first year only).

-- 1) Add columns to profiles
alter table public.profiles
  add column if not exists affiliate_code text,
  add column if not exists affiliate_assigned_at timestamptz,
  add column if not exists access_until timestamptz,
  add column if not exists is_active boolean;

comment on column public.profiles.affiliate_code is 'First affiliate/promo code this user redeemed (first attribution wins)';
comment on column public.profiles.affiliate_assigned_at is 'When affiliate_code was set';
comment on column public.profiles.access_until is 'Effective access end: greatest(subscription_expires_at, promo_access_until)';
comment on column public.profiles.is_active is 'True if user has paid subscription or promo access still valid';

-- 2) Affiliate commissions (for YouTuber / affiliate payouts)
create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  affiliate_code text not null,
  rc_event_id text,
  rc_transaction_id text,
  product_id text,
  purchased_at timestamptz not null,
  gross_amount numeric,
  net_amount numeric,
  commission_rate numeric not null default 0.25,
  commission_amount numeric not null,
  currency text,
  paid_out boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_affiliate_commissions_user_id on public.affiliate_commissions(user_id);
create index if not exists idx_affiliate_commissions_affiliate_code on public.affiliate_commissions(affiliate_code);
create unique index if not exists idx_affiliate_commissions_idempotency on public.affiliate_commissions(rc_transaction_id) where rc_transaction_id is not null;

-- RLS: no direct read/write by users (service role / edge function only)
alter table public.affiliate_commissions enable row level security;

drop policy if exists "affiliate_commissions_service_only" on public.affiliate_commissions;
create policy "affiliate_commissions_service_only"
  on public.affiliate_commissions
  for all
  to authenticated
  using (false)
  with check (false);

-- Allow service_role (used by edge functions) to manage
-- (service_role bypasses RLS by default, so no policy needed for it)

comment on table public.affiliate_commissions is 'Commission records for affiliate/promo code attributions; paid out to YouTubers etc.';

-- =============================================================================
-- SEED: YouTuber / affiliate promo codes (run manually in SQL editor if needed)
-- =============================================================================
-- insert into public.promo_codes (code, promo_type, max_uses, notes, starts_at, expires_at) values
--   ('CAPTAINMIKE',   'month_1',  500, 'YouTuber 30 days',  now(), now() + interval '1 year'),
--   ('CAPTAINMIKEVIP', 'lifetime', 1,   'YouTuber self',    now(), now() + interval '1 year'),
--   ('SAILORJANE',   'month_1',  500, 'YouTuber 30 days',  now(), now() + interval '1 year');
