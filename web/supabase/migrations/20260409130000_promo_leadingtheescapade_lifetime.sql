-- One-time lifetime Premium promo: single global redemption (max_uses = 1).
-- Code is stored uppercase; clients normalize input with upper(trim).

insert into public.promo_codes (
  code,
  promo_type,
  max_uses,
  uses,
  is_active,
  allow_multiple_per_user,
  starts_at,
  expires_at,
  notes
)
values (
  'LEADINGTHEESCAPADE',
  'lifetime',
  1,
  0,
  true,
  false,
  now() - interval '1 day',
  null,
  'One-time lifetime full Premium — single use worldwide (leadingtheescapade)'
)
on conflict (code) do update set
  promo_type = excluded.promo_type,
  max_uses = excluded.max_uses,
  is_active = excluded.is_active,
  allow_multiple_per_user = excluded.allow_multiple_per_user,
  starts_at = excluded.starts_at,
  expires_at = excluded.expires_at,
  notes = excluded.notes;
