-- RevenueCat webhook: respect promo_access_until; only delete user when both RC and promo are expired.
-- Ensures promo_access_until and promo_source are never overwritten by webhook updates.

create or replace function public.handle_subscription_webhook(
  p_event_type text,
  p_app_user_id text,
  p_product_id text,
  p_expires_at timestamptz,
  p_original_app_user_id text default null,
  p_period_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result jsonb;
  v_expires_at timestamptz;
  v_profile record;
  v_rc_expires_at timestamptz;
  v_active_via_rc boolean;
  v_active_via_promo boolean;
  v_is_active boolean;
begin
  -- Try to parse the app_user_id as UUID
  begin
    v_user_id := p_app_user_id::uuid;
  exception
    when others then
      select id into v_user_id
      from public.profiles
      where metadata->>'revenuecat_id' = p_app_user_id
      limit 1;

      if v_user_id is null then
        select id into v_user_id
        from auth.users
        where email = p_app_user_id
        limit 1;
      end if;

      if v_user_id is null and p_app_user_id like 'pending\_%' escape '\' then
        select id into v_user_id
        from auth.users
        where email = regexp_replace(p_app_user_id, '^pending_', '')
        limit 1;
      end if;
  end;

  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'app_user_id', p_app_user_id
    );
  end if;

  case p_event_type
    -- Cancellation: do NOT delete. Mark cancelled and set expiry. Do not overwrite promo_access_until.
    when 'CANCELLATION' then
      if p_period_type in ('TRIAL', 'INTRO') then
        v_expires_at := timezone('utc', now()) + interval '14 days';
      elsif p_expires_at is not null and p_expires_at > timezone('utc', now()) then
        v_expires_at := p_expires_at;
      else
        v_expires_at := timezone('utc', now()) + interval '14 days';
      end if;
      update public.profiles
      set
        subscription_status = 'cancelled',
        subscription_expires_at = v_expires_at,
        metadata = metadata || jsonb_build_object('cancelled_at', timezone('utc', now())::text, 'cancellation_period_type', coalesce(p_period_type, 'unknown')),
        updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object(
        'success', true,
        'action', 'cancelled_access_until_expiry',
        'user_id', v_user_id,
        'expires_at', v_expires_at,
        'period_type', p_period_type
      );

    -- Expiration: only delete when BOTH RC and promo access are expired (do not overwrite promo_access_until)
    when 'EXPIRATION' then
      select subscription_expires_at, promo_access_until into v_profile
      from public.profiles
      where id = v_user_id;

      v_rc_expires_at := coalesce(p_expires_at, v_profile.subscription_expires_at);
      v_active_via_rc := (v_rc_expires_at is not null and v_rc_expires_at > timezone('utc', now()));
      v_active_via_promo := (v_profile.promo_access_until is not null and v_profile.promo_access_until > timezone('utc', now()));
      v_is_active := v_active_via_rc or v_active_via_promo;

      if not v_is_active then
        v_result := public.delete_user_completely(v_user_id);
      else
        -- Still has access via promo (or RC); only update subscription fields, never promo_access_until
        update public.profiles
        set
          subscription_status = 'expired',
          subscription_expires_at = v_rc_expires_at,
          updated_at = timezone('utc', now())
        where id = v_user_id;
        v_result := jsonb_build_object(
          'success', true,
          'action', 'expiration_skipped_promo_active',
          'user_id', v_user_id,
          'promo_access_until', v_profile.promo_access_until
        );
      end if;

    when 'BILLING_ISSUE' then
      update public.profiles
      set 
        subscription_status = 'billing_issue',
        metadata = metadata || jsonb_build_object('billing_issue_at', timezone('utc', now())::text),
        updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object(
        'success', true,
        'action', 'marked_billing_issue',
        'user_id', v_user_id
      );

    when 'RENEWAL', 'INITIAL_PURCHASE', 'PRODUCT_CHANGE' then
      update public.profiles
      set 
        subscription_status = 'active',
        subscription_plan = case 
          when p_product_id like '%yearly%' then 'BoatMatey Yearly'
          else 'BoatMatey Premium'
        end,
        subscription_expires_at = p_expires_at,
        metadata = metadata || jsonb_build_object('last_renewal', timezone('utc', now())::text),
        updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object(
        'success', true,
        'action', 'renewed',
        'user_id', v_user_id,
        'expires_at', p_expires_at
      );

    when 'SUBSCRIBER_ALIAS' then
      update public.profiles
      set 
        metadata = metadata || jsonb_build_object('revenuecat_id', p_app_user_id),
        updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object(
        'success', true,
        'action', 'alias_updated',
        'user_id', v_user_id
      );

    else
      v_result := jsonb_build_object(
        'success', true,
        'action', 'logged_unknown_event',
        'event_type', p_event_type,
        'user_id', v_user_id
      );
  end case;

  return v_result;
end;
$$;

grant execute on function public.handle_subscription_webhook(text, text, text, timestamptz, text, text) to service_role;
