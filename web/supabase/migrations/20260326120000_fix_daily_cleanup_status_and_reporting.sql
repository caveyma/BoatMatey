-- Improve daily GDPR cleanup:
-- 1) mark expired accounts inactive immediately
-- 2) keep 14-day deletion window
-- 3) return failed user IDs/errors for easier debugging

create extension if not exists pg_cron with schema extensions;

create or replace function public.run_daily_gdpr_account_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_cutoff timestamptz := timezone('utc', now()) - interval '14 days';
  v_row record;
  v_result jsonb;
  v_deleted_count int := 0;
  v_failed_count int := 0;
  v_scanned_count int := 0;
  v_deactivated_count int := 0;
  v_failed_users jsonb := '[]'::jsonb;
begin
  -- Keep account state consistent even before hard deletion.
  update public.profiles p
  set
    is_active = false,
    subscription_status = case
      when p.subscription_status = 'active' then 'expired'
      else p.subscription_status
    end,
    updated_at = timezone('utc', now())
  where
    p.is_active = true
    and greatest(
      coalesce(p.subscription_expires_at, '-infinity'::timestamptz),
      coalesce(p.promo_access_until, '-infinity'::timestamptz),
      coalesce(p.access_until, '-infinity'::timestamptz)
    ) <= v_now;
  get diagnostics v_deactivated_count = row_count;

  for v_row in
    select
      p.id as user_id,
      greatest(
        coalesce(p.subscription_expires_at, '-infinity'::timestamptz),
        coalesce(p.promo_access_until, '-infinity'::timestamptz),
        coalesce(p.access_until, '-infinity'::timestamptz)
      ) as effective_until
    from public.profiles p
    where
      (p.subscription_expires_at is not null or p.promo_access_until is not null or p.access_until is not null)
      and greatest(
        coalesce(p.subscription_expires_at, '-infinity'::timestamptz),
        coalesce(p.promo_access_until, '-infinity'::timestamptz),
        coalesce(p.access_until, '-infinity'::timestamptz)
      ) < v_cutoff
  loop
    v_scanned_count := v_scanned_count + 1;

    begin
      v_result := public.delete_user_completely(v_row.user_id);
      if coalesce((v_result->>'success')::boolean, false) then
        v_deleted_count := v_deleted_count + 1;
      else
        v_failed_count := v_failed_count + 1;
        v_failed_users := v_failed_users || jsonb_build_array(
          jsonb_build_object(
            'user_id', v_row.user_id,
            'error', coalesce(v_result->>'error', 'Unknown delete_user_completely error')
          )
        );
      end if;
    exception
      when others then
        v_failed_count := v_failed_count + 1;
        v_failed_users := v_failed_users || jsonb_build_array(
          jsonb_build_object(
            'user_id', v_row.user_id,
            'error', sqlerrm
          )
        );
    end;
  end loop;

  return jsonb_build_object(
    'success', true,
    'ran_at', v_now,
    'cutoff', v_cutoff,
    'deactivated_expired', v_deactivated_count,
    'scanned_candidates', v_scanned_count,
    'deleted', v_deleted_count,
    'failed', v_failed_count,
    'failed_users', v_failed_users
  );
end;
$$;

grant execute on function public.run_daily_gdpr_account_cleanup() to service_role;

do $do$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'daily_gdpr_account_cleanup'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'daily_gdpr_account_cleanup',
    '15 3 * * *',
    $cron$select public.run_daily_gdpr_account_cleanup();$cron$
  );
end
$do$;
