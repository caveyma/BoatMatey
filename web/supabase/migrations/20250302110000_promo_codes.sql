-- Promo code redemption: 30 days, 12 months, lifetime access (parallel to app-store subscription).

-- promo codes master
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  promo_type text not null check (promo_type in ('month_1', 'month_12', 'lifetime')),
  max_uses integer not null default 1 check (max_uses >= 1),
  uses integer not null default 0 check (uses >= 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes (code);

-- redemption log
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  granted_until timestamptz not null,
  unique (user_id, promo_code_id)
);

create index if not exists promo_redemptions_user_idx on public.promo_redemptions (user_id);

-- add fields to profile table
alter table public.profiles
  add column if not exists promo_access_until timestamptz,
  add column if not exists promo_source text;

-- RLS
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- authenticated users must not read promo_codes directly
drop policy if exists "No direct promo code reads" on public.promo_codes;
create policy "No direct promo code reads"
on public.promo_codes
for select
to authenticated
using (false);

-- users can see only their own redemptions
drop policy if exists "Users can read own promo redemptions" on public.promo_redemptions;
create policy "Users can read own promo redemptions"
on public.promo_redemptions
for select
to authenticated
using (auth.uid() = user_id);

-- no direct writes by users
drop policy if exists "No direct promo redemption writes" on public.promo_redemptions;
create policy "No direct promo redemption writes"
on public.promo_redemptions
for all
to authenticated
using (false)
with check (false);

-- profiles RLS: ensure enabled (existing policies remain)
alter table public.profiles enable row level security;

-- =============================================================================
-- SEED EXAMPLES (run manually if needed)
-- =============================================================================
-- insert into public.promo_codes (code, promo_type, max_uses, notes) values
--   ('FRIEND30',  'month_1',  50, '30 days access'),
--   ('FRIEND365', 'month_12', 25, '12 months access'),
--   ('LIFETIMEVIP', 'lifetime', 5, 'Lifetime access');
