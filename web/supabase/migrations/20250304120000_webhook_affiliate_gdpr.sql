-- RevenueCat webhook: merge paid + promo access (access_until, is_active), never overwrite promo/affiliate.
-- Affiliate commission recording on INITIAL_PURCHASE/RENEWAL (first year only).
-- GDPR: delete only when effective_access_until is null or older than 14 days.

create or replace function public.handle_subscription_webhook(
  p_event_type text,
  p_app_user_id text,
  p_product_id text,
  p_expires_at timestamptz,
  p_original_app_user_id text default null,
  p_period_type text default null,
  p_rc_event_id text default null,
  p_rc_transaction_id text default null,
  p_purchased_at_ms bigint default null,
  p_price numeric default null,
  p_currency text default null
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
  v_promo_until timestamptz;
  v_effective_until timestamptz;
  v_active_via_rc boolean;
  v_active_via_promo boolean;
  v_is_active boolean;
  v_should_delete boolean;
  v_affiliate_code text;
  v_affiliate_at timestamptz;
  v_purchased_at timestamptz;
  v_net_amount numeric;
  v_commission numeric;
  v_commission_rate numeric := 0.25;
begin
  begin
    v_user_id := p_app_user_id::uuid;
  exception
    when others then
      select id into v_user_id from public.profiles where metadata->>'revenuecat_id' = p_app_user_id limit 1;
      if v_user_id is null then
        select id into v_user_id from auth.users where email = p_app_user_id limit 1;
      end if;
      if v_user_id is null and p_app_user_id like 'pending\_%' escape '\' then
        select id into v_user_id from auth.users where email = regexp_replace(p_app_user_id, '^pending_', '') limit 1;
      end if;
  end;

  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'User not found', 'app_user_id', p_app_user_id);
  end if;

  case p_event_type
    when 'CANCELLATION' then
      if p_period_type in ('TRIAL', 'INTRO') then
        v_expires_at := timezone('utc', now()) + interval '14 days';
      elsif p_expires_at is not null and p_expires_at > timezone('utc', now()) then
        v_expires_at := p_expires_at;
      else
        v_expires_at := timezone('utc', now()) + interval '14 days';
      end if;
      select promo_access_until into v_promo_until from public.profiles where id = v_user_id;
      v_effective_until := greatest(v_expires_at, coalesce(v_promo_until, v_expires_at));
      v_is_active := (v_effective_until is not null and v_effective_until > timezone('utc', now()));
      update public.profiles
      set
        subscription_status = 'cancelled',
        subscription_expires_at = v_expires_at,
        access_until = v_effective_until,
        is_active = v_is_active,
        metadata = metadata || jsonb_build_object('cancelled_at', timezone('utc', now())::text, 'cancellation_period_type', coalesce(p_period_type, 'unknown')),
        updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object('success', true, 'action', 'cancelled_access_until_expiry', 'user_id', v_user_id, 'expires_at', v_expires_at, 'period_type', p_period_type);

    when 'EXPIRATION' then
      select subscription_expires_at, promo_access_until, access_until into v_profile
      from public.profiles where id = v_user_id;

      v_rc_expires_at := coalesce(p_expires_at, v_profile.subscription_expires_at);
      v_promo_until := v_profile.promo_access_until;
      v_effective_until := greatest(v_rc_expires_at, v_promo_until, v_profile.access_until);
      v_active_via_rc := (v_rc_expires_at is not null and v_rc_expires_at > timezone('utc', now()));
      v_active_via_promo := (v_promo_until is not null and v_promo_until > timezone('utc', now()));
      v_is_active := v_active_via_rc or v_active_via_promo;
      v_should_delete := (v_effective_until is null or v_effective_until < timezone('utc', now()) - interval '14 days');

      if v_should_delete and not v_is_active then
        v_result := public.delete_user_completely(v_user_id);
      else
        update public.profiles
        set
          subscription_status = 'expired',
          subscription_expires_at = v_rc_expires_at,
          access_until = v_effective_until,
          is_active = v_is_active,
          updated_at = timezone('utc', now())
        where id = v_user_id;
        v_result := jsonb_build_object('success', true, 'action', 'expiration_skipped_promo_active', 'user_id', v_user_id, 'promo_access_until', v_profile.promo_access_until);
      end if;

    when 'BILLING_ISSUE' then
      select access_until, is_active, promo_access_until, subscription_expires_at into v_profile from public.profiles where id = v_user_id;
      v_effective_until := greatest(v_profile.subscription_expires_at, v_profile.promo_access_until, v_profile.access_until);
      v_is_active := (v_effective_until is not null and v_effective_until > timezone('utc', now()));
      update public.profiles
      set subscription_status = 'billing_issue', access_until = v_effective_until, is_active = v_is_active,
          metadata = metadata || jsonb_build_object('billing_issue_at', timezone('utc', now())::text), updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object('success', true, 'action', 'marked_billing_issue', 'user_id', v_user_id);

    when 'RENEWAL', 'INITIAL_PURCHASE', 'PRODUCT_CHANGE' then
      select affiliate_code, affiliate_assigned_at, promo_access_until, subscription_expires_at into v_profile from public.profiles where id = v_user_id;
      v_effective_until := greatest(p_expires_at, v_profile.promo_access_until, v_profile.subscription_expires_at);
      v_is_active := (v_effective_until is not null and v_effective_until > timezone('utc', now()));
      update public.profiles
      set
        subscription_status = 'active',
        subscription_plan = case when p_product_id like '%yearly%' then 'BoatMatey Yearly' else 'BoatMatey Premium' end,
        subscription_expires_at = p_expires_at,
        access_until = v_effective_until,
        is_active = v_is_active,
        metadata = metadata || jsonb_build_object('last_renewal', timezone('utc', now())::text),
        updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object('success', true, 'action', 'renewed', 'user_id', v_user_id, 'expires_at', p_expires_at);

      v_affiliate_code := v_profile.affiliate_code;
      v_affiliate_at := v_profile.affiliate_assigned_at;
      if v_affiliate_code is not null and v_affiliate_at is not null and p_purchased_at_ms is not null then
        v_purchased_at := to_timestamp(p_purchased_at_ms / 1000.0) at time zone 'utc';
        if v_purchased_at <= v_affiliate_at + interval '365 days' then
          /* TODO: use true net revenue (after store fees/tax) when available from webhook payload */
          v_net_amount := coalesce(p_price, 0);
          v_commission := round((v_net_amount * v_commission_rate)::numeric, 2);
          if v_commission > 0 and (p_rc_transaction_id is null or not exists (select 1 from public.affiliate_commissions where rc_transaction_id = p_rc_transaction_id)) then
            insert into public.affiliate_commissions (
              user_id, affiliate_code, rc_event_id, rc_transaction_id, product_id,
              purchased_at, gross_amount, net_amount, commission_rate, commission_amount, currency
            ) values (
              v_user_id, v_affiliate_code, p_rc_event_id, p_rc_transaction_id, p_product_id,
              v_purchased_at, p_price, v_net_amount, v_commission_rate, v_commission, p_currency
            );
          end if;
        end if;
      end if;

    when 'SUBSCRIBER_ALIAS' then
      update public.profiles
      set metadata = metadata || jsonb_build_object('revenuecat_id', p_app_user_id), updated_at = timezone('utc', now())
      where id = v_user_id;
      v_result := jsonb_build_object('success', true, 'action', 'alias_updated', 'user_id', v_user_id);

    else
      v_result := jsonb_build_object('success', true, 'action', 'logged_unknown_event', 'event_type', p_event_type, 'user_id', v_user_id);
  end case;

  return v_result;
end;
$$;

grant execute on function public.handle_subscription_webhook(text, text, text, timestamptz, text, text, text, text, bigint, numeric, text) to service_role;