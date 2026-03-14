-- Normalize Friend1 to FRIEND1 so it matches client/edge-function lookup (uppercase).
update public.promo_codes
set code = 'FRIEND1'
where code = 'Friend1';
