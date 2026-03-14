-- One-off: apply FRIEND1 promo to a user whose profile has null promo fields after signup.
-- Run in Supabase SQL Editor. Replace the user_id below with the target user's id.
-- If the user no longer exists in auth.users, only the profile is updated (no redemption row).

do $$
declare
  v_user_id uuid := '98868585-52d7-4073-bec3-4f642cc4e82c';
  v_promo_id uuid;
  v_granted_until timestamptz := now() + interval '1 day';
  v_rows int;
begin
  select id into v_promo_id from public.promo_codes where code = 'FRIEND1' limit 1;
  if v_promo_id is null then
    raise exception 'FRIEND1 promo code not found';
  end if;

  -- Update profile first (works even if user was removed from auth.users)
  update public.profiles
  set
    promo_access_until = v_granted_until,
    promo_source = 'promo:FRIEND1',
    access_until = greatest(coalesce(access_until, '1970-01-01'::timestamptz), v_granted_until),
    is_active = coalesce(is_active, true),
    updated_at = now()
  where id = v_user_id;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'No profile found for user_id %', v_user_id;
  end if;

  -- Only insert redemption if user exists in auth (FK); skip if user was deleted
  begin
    insert into public.promo_redemptions (user_id, promo_code_id, granted_until)
    values (v_user_id, v_promo_id, v_granted_until)
    on conflict (user_id, promo_code_id) do update set granted_until = v_granted_until, redeemed_at = now();
  exception
    when foreign_key_violation then
      raise notice 'User not in auth.users; profile updated, redemption skipped for %', v_user_id;
  end;

  raise notice 'Applied FRIEND1 promo for user %', v_user_id;
end $$;
