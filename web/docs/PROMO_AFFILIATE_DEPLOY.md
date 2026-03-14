# Promo + Affiliate: Deploy and Run

## Migrations

From the `web` directory (or project root with Supabase linked):

```bash
supabase db push
# or apply individually:
# supabase migration up
```

Relevant migrations:
- `20250304110000_promo_affiliate.sql` – profiles columns (`affiliate_code`, `affiliate_assigned_at`, `access_until`, `is_active`), `affiliate_commissions` table, RLS.
- `20250304120000_webhook_affiliate_gdpr.sql` – `handle_subscription_webhook` updated for paid+promo merge, commissions, 14-day GDPR deletion.

## Edge functions

Deploy all three:

```bash
cd web
supabase functions deploy validate-promo
supabase functions deploy redeem-promo
supabase functions deploy revenuecat-webhook
```

- **validate-promo**: no auth. Validates a promo code (exists, active, within dates, uses left). Used by the web onboarding flow before account creation. No new SQL required; reads existing `promo_codes` table.
- **redeem-promo**: requires user JWT. Applies the code to the signed-in user (profile + redemptions).
- **revenuecat-webhook**: called by RevenueCat; ensure the project URL and (optional) webhook secret are set in RevenueCat.

## Creating promo codes (SQL)

Run in Supabase SQL Editor (or via migration/seed). Example:

```sql
insert into public.promo_codes (code, promo_type, max_uses, notes, starts_at, expires_at) values
  ('CAPTAINMIKE',    'month_1',   500, 'YouTuber 30 days',  now(), now() + interval '1 year'),
  ('CAPTAINMIKEVIP', 'lifetime',  1,   'YouTuber self',      now(), now() + interval '1 year'),
  ('SAILORJANE',     'month_1',   500, 'YouTuber 30 days',  now(), now() + interval '1 year');
```

- `promo_type`: `month_1` (30 days), `month_12` (365 days), `lifetime`.
- Use `starts_at` / `expires_at` to limit when the code can be used.

## Flow summary (web onboarding – promo first)

1. **Web**: User visits `/redeem` (or is redirected there when unauthenticated). Enters promo code → **validate-promo** checks it (no account created).
2. If valid: user sees email/password form → creates account (Supabase Auth + profile) → **redeem-promo** is called with the same code → user is signed in and redirected to dashboard.
3. If invalid: error shown; no Supabase user is ever created.
4. RevenueCat webhook: on paid events, `access_until` / `is_active` are merged with promo; commissions are recorded for the first year when `affiliate_code` is set.
5. GDPR: user data is deleted only when `effective_access_until` (max of subscription and promo) is null or older than 14 days.
