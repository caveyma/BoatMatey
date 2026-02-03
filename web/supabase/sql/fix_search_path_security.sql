-- Fix "Function Search Path Mutable" security warnings
-- Run this in the Supabase SQL Editor to update existing functions with search_path = ''
-- This prevents potential privilege escalation attacks.

-- 1) handle_updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 2) delete_user_completely
create or replace function public.delete_user_completely(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_boats_deleted int := 0;
  v_engines_deleted int := 0;
  v_services_deleted int := 0;
  v_equipment_deleted int := 0;
  v_logbook_deleted int := 0;
  v_haulout_deleted int := 0;
  v_attachments_deleted int := 0;
  v_profile_deleted boolean := false;
  v_profile_row_count int;
  v_result jsonb;
begin
  raise notice 'Starting GDPR deletion for user: %', p_user_id;

  delete from public.attachments where owner_id = p_user_id;
  get diagnostics v_attachments_deleted = row_count;

  delete from public.logbook_entries where owner_id = p_user_id;
  get diagnostics v_logbook_deleted = row_count;

  delete from public.equipment_items where owner_id = p_user_id;
  get diagnostics v_equipment_deleted = row_count;

  begin
    delete from public.haulout_entries where owner_id = p_user_id;
    get diagnostics v_haulout_deleted = row_count;
  exception
    when undefined_table then
      raise notice 'Table public.haulout_entries does not exist, skipping for user %', p_user_id;
      v_haulout_deleted := 0;
  end;

  delete from public.service_entries where owner_id = p_user_id;
  get diagnostics v_services_deleted = row_count;

  delete from public.engines where owner_id = p_user_id;
  get diagnostics v_engines_deleted = row_count;

  delete from public.boats where owner_id = p_user_id;
  get diagnostics v_boats_deleted = row_count;

  delete from public.profiles where id = p_user_id;
  get diagnostics v_profile_row_count = row_count;
  v_profile_deleted := (v_profile_row_count > 0);

  delete from auth.users where id = p_user_id;

  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'deleted_at', timezone('utc', now()),
    'summary', jsonb_build_object(
      'boats', v_boats_deleted,
      'engines', v_engines_deleted,
      'service_entries', v_services_deleted,
      'equipment', v_equipment_deleted,
      'logbook_entries', v_logbook_deleted,
      'haulout_entries', v_haulout_deleted,
      'attachments', v_attachments_deleted,
      'profile', v_profile_deleted
    )
  );

  raise notice 'GDPR deletion complete for user %: %', p_user_id, v_result;
  return v_result;
exception
  when others then
    raise notice 'GDPR deletion failed for user %: %', p_user_id, sqlerrm;
    return jsonb_build_object(
      'success', false,
      'user_id', p_user_id,
      'error', sqlerrm
    );
end;
$$;

-- 3) delete_current_user_completely
create or replace function public.delete_current_user_completely()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  end if;
  return public.delete_user_completely(v_user_id);
end;
$$;

-- 4) delete_user_self
create or replace function public.delete_user_self(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
begin
  if v_auth_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  end if;
  if v_auth_id <> p_user_id then
    return jsonb_build_object(
      'success', false,
      'error', 'Not authorized to delete this user'
    );
  end if;
  return public.delete_user_completely(p_user_id);
end;
$$;

-- 5) handle_subscription_webhook
create or replace function public.handle_subscription_webhook(
  p_event_type text,
  p_app_user_id text,
  p_product_id text,
  p_expires_at timestamptz,
  p_original_app_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
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
    when 'CANCELLATION' then
      v_result := public.delete_user_completely(v_user_id);
    when 'EXPIRATION' then
      v_result := public.delete_user_completely(v_user_id);
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

-- 6) update_subscription_from_webhook
create or replace function public.update_subscription_from_webhook(
  p_user_id uuid,
  p_subscription_status text,
  p_product_id text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    subscription_status = p_subscription_status,
    subscription_plan = case
      when p_product_id like '%yearly%' then 'BoatMatey Yearly'
      when p_product_id like '%monthly%' then 'BoatMatey Monthly'
      else 'BoatMatey Premium'
    end,
    subscription_expires_at = p_expires_at,
    updated_at = timezone('utc', now())
  where id = p_user_id;
end;
$$;

-- 7) archive_boat
create or replace function public.archive_boat(p_boat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.boats where id = p_boat_id;
  if v_owner_id is null or v_owner_id != auth.uid() then
    raise exception 'Boat not found or access denied';
  end if;

  update public.boats
  set status = 'archived', updated_at = timezone('utc', now())
  where id = p_boat_id and status = 'active';

  if not found then
    raise exception 'Boat not found or already archived';
  end if;

  delete from public.attachments
  where boat_id = p_boat_id
    and entity_type in ('boat', 'engine', 'equipment', 'haulout');

  delete from public.boat_links where boat_id = p_boat_id;
end;
$$;

-- 8) reactivate_boat
create or replace function public.reactivate_boat(p_boat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.boats where id = p_boat_id;
  if v_owner_id is null or v_owner_id != auth.uid() then
    raise exception 'Boat not found or access denied';
  end if;

  update public.boats
  set status = 'active', updated_at = timezone('utc', now())
  where id = p_boat_id and status = 'archived';

  if not found then
    raise exception 'Boat not found or not archived';
  end if;
end;
$$;

-- Note: handle_new_user_profile is not in local SQL files.
-- If it exists in your database, update it manually with:
-- ALTER FUNCTION public.handle_new_user_profile() SET search_path = '';
