-- ============================================================================
-- SUBSCRIPTION CANCELLATION HANDLER
-- GDPR Compliant: Deletes all user data when subscription is cancelled/expired
-- ============================================================================

-- Function to completely delete a user and all their data
-- Called when subscription is cancelled via RevenueCat webhook
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
  -- Log the deletion request
  raise notice 'Starting GDPR deletion for user: %', p_user_id;

  -- 1. Delete all attachments (and storage objects)
  -- Note: Storage objects should be deleted separately via storage API
  delete from public.attachments where owner_id = p_user_id;
  get diagnostics v_attachments_deleted = row_count;

  -- 2. Delete all logbook entries
  delete from public.logbook_entries where owner_id = p_user_id;
  get diagnostics v_logbook_deleted = row_count;

  -- 3. Delete all equipment items
  delete from public.equipment_items where owner_id = p_user_id;
  get diagnostics v_equipment_deleted = row_count;

  -- 4. Delete all haulout entries (table may not exist in older schemas)
  begin
    delete from public.haulout_entries where owner_id = p_user_id;
    get diagnostics v_haulout_deleted = row_count;
  exception
    when undefined_table then
      -- Older databases may not have this table yet; skip instead of failing
      raise notice 'Table public.haulout_entries does not exist, skipping for user %', p_user_id;
      v_haulout_deleted := 0;
  end;

  -- 5. Delete all service entries
  delete from public.service_entries where owner_id = p_user_id;
  get diagnostics v_services_deleted = row_count;

  -- 6. Delete all engines
  delete from public.engines where owner_id = p_user_id;
  get diagnostics v_engines_deleted = row_count;

  -- 7. Delete all boats (this should cascade, but explicit for clarity)
  delete from public.boats where owner_id = p_user_id;
  get diagnostics v_boats_deleted = row_count;

  -- 8. Delete the profile
  delete from public.profiles where id = p_user_id;
  get diagnostics v_profile_row_count = row_count;
  v_profile_deleted := (v_profile_row_count > 0);

  -- 9. Delete the auth user (this completes the GDPR deletion)
  -- Note: This requires the function to run with elevated privileges
  -- The auth.users deletion should cascade to profiles anyway, but we do it explicitly
  delete from auth.users where id = p_user_id;

  -- Build result summary
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

-- Grant execute to service_role (used by Edge Functions)
grant execute on function public.delete_user_completely(uuid) to service_role;

-- Convenience wrapper for the currently authenticated user.
-- This allows logged-in users to delete their own account and all data
-- via an RPC call without needing service_role privileges.
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

grant execute on function public.delete_current_user_completely() to authenticated;

-- Variant that accepts an explicit user_id but enforces that it matches auth.uid().
-- This can be called from the app with the current session user.id and provides
-- clearer error messages if something is misconfigured.
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

grant execute on function public.delete_user_self(uuid) to authenticated;

-- Function to handle subscription status updates from RevenueCat webhook
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
  -- Try to parse the app_user_id as UUID
  begin
    v_user_id := p_app_user_id::uuid;
  exception
    when others then
      -- If not a UUID, try to find user by RevenueCat ID in metadata
      select id into v_user_id
      from public.profiles
      where metadata->>'revenuecat_id' = p_app_user_id
      limit 1;

      -- If still null, try auth.users by email (RevenueCat often sends email as app_user_id)
      if v_user_id is null then
        select id into v_user_id
        from auth.users
        where email = p_app_user_id
        limit 1;
      end if;

      -- RevenueCat may send "pending_<email>" alias before email is verified
      if v_user_id is null and p_app_user_id like 'pending\_%' escape '\' then
        select id into v_user_id
        from auth.users
        where email = regexp_replace(p_app_user_id, '^pending_', '')
        limit 1;
      end if;
  end;

  -- If still no user found, return error
  if v_user_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'User not found',
      'app_user_id', p_app_user_id
    );
  end if;

  -- Handle different event types
  case p_event_type
    -- Cancellation events - delete user and all data so they cannot log back in
    when 'CANCELLATION' then
      v_result := public.delete_user_completely(v_user_id);

    -- Expiration events - subscription has actually expired
    when 'EXPIRATION' then
      -- GDPR: Delete user and all their data
      v_result := public.delete_user_completely(v_user_id);

    -- Billing issue - mark as at risk but don't delete yet
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

    -- Renewal - subscription renewed successfully
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

    -- Subscriber alias - update the user's RevenueCat ID
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
      -- Unknown event type - just log it
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

-- Grant execute to service_role
grant execute on function public.handle_subscription_webhook(text, text, text, timestamptz, text) to service_role;

-- Create a table to log webhook events (for debugging and audit)
create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz default timezone('utc', now())
);

-- Index for querying logs
create index if not exists idx_webhook_logs_event_type on public.webhook_logs(event_type);
create index if not exists idx_webhook_logs_created_at on public.webhook_logs(created_at);

-- RLS on webhook_logs - only service_role can access (e.g. Edge Function)
alter table public.webhook_logs enable row level security;

-- Explicit policy: no access for anon/authenticated; service_role bypasses RLS so can still insert/select
create policy "webhook_logs_service_only"
  on public.webhook_logs
  for all
  using (false)
  with check (false);

comment on table public.webhook_logs is 'Logs of RevenueCat webhook events for audit and debugging';

-- View for admin to see subscription cancellations
create or replace view public.subscription_events as
select 
  id,
  event_type,
  payload->>'app_user_id' as user_id,
  payload->>'product_id' as product_id,
  result->>'action' as action_taken,
  result->>'success' as success,
  created_at
from public.webhook_logs
order by created_at desc;

comment on view public.subscription_events is 'Summary view of subscription webhook events';
