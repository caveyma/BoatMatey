-- Inactive account cleanup: hard-delete only when ALL hold:
--   1) subscription_status is not 'active' (case-insensitive; matches app subscription.js)
--   2) last login (or coalesce fallbacks) older than 90 days
--   3) no future BoatMatey reminders (aligned with web calendar.js aggregation)
--
-- LIVE vs DRY-RUN: update cleanup_job_settings (see comment at end of file).

create extension if not exists pg_cron with schema extensions;

-- calendar_events: ensure recurrence override columns exist if table predates 20260328140000
do $cal$
begin
  if exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'calendar_events'
  ) then
    alter table public.calendar_events
      add column if not exists exception_dates jsonb not null default '[]'::jsonb;
    alter table public.calendar_events
      add column if not exists occurrence_overrides jsonb not null default '{}'::jsonb;
  end if;
end
$cal$;

-- ---------------------------------------------------------------------------
-- Settings (dry-run default ON)
-- ---------------------------------------------------------------------------
create table if not exists public.cleanup_job_settings (
  job_name text primary key,
  dry_run boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.cleanup_job_settings (job_name, dry_run)
values ('inactive_account_cleanup', true)
on conflict (job_name) do nothing;

revoke all on public.cleanup_job_settings from public;
grant select, update, insert, delete on public.cleanup_job_settings to service_role;

comment on table public.cleanup_job_settings is
  'Per-job flags for scheduled maintenance. For inactive_account_cleanup: set dry_run=false to perform real deletes (service_role / SQL editor).';

-- ---------------------------------------------------------------------------
-- Run log (audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.inactive_account_cleanup_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default timezone('utc', now()),
  dry_run boolean not null,
  candidates jsonb not null default '[]'::jsonb,
  deleted_users jsonb not null default '[]'::jsonb,
  failed_users jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb
);

create index if not exists idx_inactive_cleanup_log_ran_at
  on public.inactive_account_cleanup_log (ran_at desc);

revoke all on public.inactive_account_cleanup_log from public;
grant select, insert on public.inactive_account_cleanup_log to service_role;

comment on table public.inactive_account_cleanup_log is
  'Append-only log for run_inactive_account_cleanup: who would be / was deleted.';

-- ---------------------------------------------------------------------------
-- JSON helpers (service entry / engine / equipment details are often JSON text)
-- ---------------------------------------------------------------------------
create or replace function public.bm_try_parse_jsonb(p_text text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_text is null or btrim(p_text) = '' then
    return null;
  end if;
  return p_text::jsonb;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.bm_try_parse_jsonb(text) from public;
grant execute on function public.bm_try_parse_jsonb(text) to service_role;

-- ---------------------------------------------------------------------------
-- Calendar: future occurrence with reminder_minutes > 0 (mirrors calendar.js)
-- ---------------------------------------------------------------------------
create or replace function public.bm_calendar_row_has_future_reminder(
  p_start date,
  p_repeat text,
  p_repeat_until date,
  p_reminder_minutes int,
  p_exception_dates jsonb,
  p_occurrence_overrides jsonb,
  p_today date
) returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_type text;
  v_cursor date;
  v_series_end date;
  v_default_end date;
  v_iso text;
  v_eff_rem int;
  v_ov jsonb;
  v_max_iterations int := 1200;
  v_iter int := 0;
  v_excluded boolean;
begin
  if p_start is null then
    return false;
  end if;

  v_type := lower(trim(coalesce(p_repeat, '')));
  if v_type = '' or v_type = 'none' then
    if p_start < p_today then
      return false;
    end if;
    v_eff_rem := p_reminder_minutes;
    v_iso := to_char(p_start, 'YYYY-MM-DD');
    v_ov := coalesce(p_occurrence_overrides, '{}'::jsonb) -> v_iso;
    if v_ov is not null and jsonb_typeof(v_ov) = 'object' and v_ov ? 'reminder_minutes' then
      if v_ov->>'reminder_minutes' is null or lower(v_ov->>'reminder_minutes') = 'null' then
        v_eff_rem := null;
      else
        v_eff_rem := (v_ov->>'reminder_minutes')::int;
      end if;
    end if;
    return coalesce(v_eff_rem, 0) > 0;
  end if;

  v_cursor := p_start;
  v_default_end := (p_start + interval '12 months')::date;
  if p_repeat_until is not null and p_repeat_until < v_default_end then
    v_series_end := p_repeat_until;
  else
    v_series_end := v_default_end;
  end if;

  if v_series_end > p_today + 540 then
    v_series_end := p_today + 540;
  end if;

  while v_cursor <= v_series_end and v_iter < v_max_iterations loop
    v_iter := v_iter + 1;

    if v_cursor >= p_today then
      v_iso := to_char(v_cursor, 'YYYY-MM-DD');
      select exists (
        select 1
        from jsonb_array_elements_text(coalesce(p_exception_dates, '[]'::jsonb)) ex(exd)
        where ex.exd = v_iso
      ) into v_excluded;

      if not v_excluded then
        v_eff_rem := p_reminder_minutes;
        v_ov := coalesce(p_occurrence_overrides, '{}'::jsonb) -> v_iso;
        if v_ov is not null and jsonb_typeof(v_ov) = 'object' and v_ov ? 'reminder_minutes' then
          if v_ov->>'reminder_minutes' is null or lower(v_ov->>'reminder_minutes') = 'null' then
            v_eff_rem := null;
          else
            v_eff_rem := (v_ov->>'reminder_minutes')::int;
          end if;
        end if;
        if coalesce(v_eff_rem, 0) > 0 then
          return true;
        end if;
      end if;
    end if;

    if v_type = 'daily' then
      v_cursor := v_cursor + 1;
    elsif v_type = 'weekly' then
      v_cursor := v_cursor + 7;
    elsif v_type = 'monthly' then
      v_cursor := (v_cursor + interval '1 month')::date;
    elsif v_type = 'yearly' then
      v_cursor := (v_cursor + interval '1 year')::date;
    else
      return p_start >= p_today and coalesce(p_reminder_minutes, 0) > 0;
    end if;
  end loop;

  return false;
end;
$$;

revoke all on function public.bm_calendar_row_has_future_reminder(date, text, date, int, jsonb, jsonb, date) from public;
grant execute on function public.bm_calendar_row_has_future_reminder(date, text, date, int, jsonb, jsonb, date) to service_role;

-- ---------------------------------------------------------------------------
-- True if user has any reminder the app would surface as upcoming (calendar.js)
-- ---------------------------------------------------------------------------
create or replace function public.user_has_future_boatmatey_reminder(p_user_id uuid)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date := (timezone('utc', now()))::date;
  v_due date;
  v_mins int;
  r_svc record;
  r_eng record;
  r_equip record;
begin
  -- Next service due (JSON in service_entries.description — see dataService createServiceEntry)
  for r_svc in
    select public.bm_try_parse_jsonb(se.description) as doc
    from public.service_entries se
    where se.owner_id = p_user_id
      and se.description is not null
      and btrim(se.description) like '{%'
  loop
    continue when r_svc.doc is null;
    if r_svc.doc ? 'next_service_due' and nullif(trim(r_svc.doc->>'next_service_due'), '') is not null then
      begin
        v_due := (r_svc.doc->>'next_service_due')::date;
      exception when others then
        v_due := null;
      end;
      if v_due is not null and v_due >= v_today then
        v_mins := coalesce(nullif((r_svc.doc->>'next_service_reminder_minutes')::int, 0), 1440);
        if v_mins > 0 then
          return true;
        end if;
      end if;
    end if;
  end loop;

  -- Haul-out next due (columns from haulout migration)
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'haulout_entries'
      and c.column_name = 'next_haulout_due'
  ) then
    if exists (
      select 1
      from public.haulout_entries h
      where h.owner_id = p_user_id
        and h.next_haulout_due is not null
        and h.next_haulout_due >= v_today
        and coalesce(nullif(h.next_haulout_reminder_minutes, 0), 1440) > 0
    ) then
      return true;
    end if;
  end if;

  -- Engine warranty (JSON in engines.notes — engine-edit.js)
  for r_eng in
    select public.bm_try_parse_jsonb(e.notes) as doc
    from public.engines e
    where e.owner_id = p_user_id
      and e.notes is not null
  loop
    continue when r_eng.doc is null;
    if r_eng.doc ? 'warranty_expiry_date' and nullif(trim(r_eng.doc->>'warranty_expiry_date'), '') is not null then
      begin
        v_due := (r_eng.doc->>'warranty_expiry_date')::date;
      exception when others then
        v_due := null;
      end;
      if v_due is not null and v_due >= v_today then
        v_mins := coalesce(nullif((r_eng.doc->>'warranty_reminder_minutes')::int, 0), 10080);
        if v_mins > 0 then
          return true;
        end if;
      end if;
    end if;
  end loop;

  -- Navigation / safety equipment: expiry_date column and/or JSON details
  for r_equip in
    select
      ei.expiry_date,
      public.bm_try_parse_jsonb(ei.details) as details_json
    from public.equipment_items ei
    where ei.owner_id = p_user_id
  loop
    begin
      if r_equip.expiry_date is not null and r_equip.expiry_date >= v_today then
        v_mins := 10080;
        if r_equip.details_json is not null and r_equip.details_json ? 'warranty_reminder_minutes' then
          v_mins := coalesce(nullif((r_equip.details_json->>'warranty_reminder_minutes')::int, 0), 10080);
        end if;
        if v_mins > 0 then
          return true;
        end if;
      end if;
      if r_equip.details_json is not null and r_equip.details_json ? 'warranty_expiry_date'
         and nullif(trim(r_equip.details_json->>'warranty_expiry_date'), '') is not null then
        v_due := (r_equip.details_json->>'warranty_expiry_date')::date;
        if v_due >= v_today then
          v_mins := coalesce(nullif((r_equip.details_json->>'warranty_reminder_minutes')::int, 0), 10080);
          if v_mins > 0 then
            return true;
          end if;
        end if;
      end if;
    exception when others then
      null;
    end;
  end loop;

  -- Calendar appointments (table may exist from manual SQL)
  if exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = 'calendar_events'
  ) then
    if exists (
      select 1
      from public.calendar_events ce
      where ce.owner_id = p_user_id
        and public.bm_calendar_row_has_future_reminder(
          ce.date,
          ce.repeat,
          ce.repeat_until,
          ce.reminder_minutes,
          ce.exception_dates,
          ce.occurrence_overrides,
          v_today
        )
    ) then
      return true;
    end if;
  end if;

  -- Watermaker next service (boats.watermaker_data JSON — watermaker.js)
  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'boats' and c.column_name = 'watermaker_data'
  ) then
    if exists (
      select 1
      from public.boats b
      where b.owner_id = p_user_id
        and b.watermaker_data is not null
        and jsonb_typeof(b.watermaker_data) = 'object'
        and (
          (
            nullif(trim(b.watermaker_data->>'next_service_due'), '') is not null
            and nullif(trim(b.watermaker_data->>'next_service_due'), '') ~ '^\d{4}-\d{2}-\d{2}$'
            and (nullif(trim(b.watermaker_data->>'next_service_due'), ''))::date >= v_today
          )
          or exists (
            select 1
            from jsonb_array_elements(coalesce(b.watermaker_data->'services', '[]'::jsonb)) s
            where nullif(trim(s->>'next_service_due'), '') is not null
              and nullif(trim(s->>'next_service_due'), '') ~ '^\d{4}-\d{2}-\d{2}$'
              and (nullif(trim(s->>'next_service_due'), ''))::date >= v_today
          )
        )
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

revoke all on function public.user_has_future_boatmatey_reminder(uuid) from public;
grant execute on function public.user_has_future_boatmatey_reminder(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Hard delete: ensure calendar rows are removed (FK is to boats; explicit is safe)
-- ---------------------------------------------------------------------------
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
  v_calendar_deleted int := 0;
  v_profile_deleted boolean := false;
  v_profile_row_count int;
  v_result jsonb;
begin
  raise notice 'Starting GDPR deletion for user: %', p_user_id;

  delete from public.attachments where owner_id = p_user_id;
  get diagnostics v_attachments_deleted = row_count;

  begin
    delete from public.calendar_events where owner_id = p_user_id;
    get diagnostics v_calendar_deleted = row_count;
  exception
    when undefined_table then
      v_calendar_deleted := 0;
  end;

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
      'calendar_events', v_calendar_deleted,
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

-- ---------------------------------------------------------------------------
-- Main job: preview or delete
-- ---------------------------------------------------------------------------
create or replace function public.run_inactive_account_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dry_run boolean := true;
  v_now timestamptz := timezone('utc', now());
  v_cutoff timestamptz := timezone('utc', now()) - interval '90 days';
  v_row record;
  v_result jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_deleted jsonb := '[]'::jsonb;
  v_failed jsonb := '[]'::jsonb;
  v_deleted_count int := 0;
  v_failed_count int := 0;
  v_sub_active boolean;
  v_login_stale boolean;
  v_has_rem boolean;
  v_eligible boolean;
begin
  select c.dry_run
  into v_dry_run
  from public.cleanup_job_settings c
  where c.job_name = 'inactive_account_cleanup';

  if v_dry_run is null then
    v_dry_run := true;
  end if;

  for v_row in
    select
      p.id as user_id,
      p.email,
      p.full_name,
      p.subscription_status,
      p.last_login_at,
      p.created_at as profile_created_at
    from public.profiles p
  loop
    v_sub_active := lower(trim(coalesce(v_row.subscription_status, ''))) = 'active';
    v_login_stale := coalesce(v_row.last_login_at, v_row.profile_created_at, '-infinity'::timestamptz) < v_cutoff;
    v_has_rem := public.user_has_future_boatmatey_reminder(v_row.user_id);
    v_eligible := (not v_sub_active) and v_login_stale and (not v_has_rem);

    if v_eligible then
      v_candidates := v_candidates || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_row.user_id,
          'email', v_row.email,
          'full_name', v_row.full_name,
          'subscription_status', v_row.subscription_status,
          'last_login_at', v_row.last_login_at,
          'has_future_reminder', v_has_rem,
          'would_delete', true
        )
      );
    end if;
  end loop;

  if v_dry_run then
    insert into public.inactive_account_cleanup_log (dry_run, candidates, deleted_users, failed_users, summary)
    values (
      true,
      v_candidates,
      '[]'::jsonb,
      '[]'::jsonb,
      jsonb_build_object(
        'ran_at', v_now,
        'mode', 'dry_run',
        'cutoff', v_cutoff,
        'candidate_count', jsonb_array_length(v_candidates)
      )
    );

    return jsonb_build_object(
      'success', true,
      'dry_run', true,
      'ran_at', v_now,
      'cutoff', v_cutoff,
      'candidate_count', jsonb_array_length(v_candidates),
      'candidates', v_candidates,
      'message',
        'No users were deleted. Set cleanup_job_settings.dry_run=false for inactive_account_cleanup to enable live deletes.'
    );
  end if;

  for v_row in
    select
      p.id as user_id,
      p.email
    from public.profiles p
    where lower(trim(coalesce(p.subscription_status, ''))) <> 'active'
      and coalesce(p.last_login_at, p.created_at, '-infinity'::timestamptz) < v_cutoff
      and not public.user_has_future_boatmatey_reminder(p.id)
  loop
    begin
      v_result := public.delete_user_completely(v_row.user_id);
      if coalesce((v_result->>'success')::boolean, false) then
        v_deleted_count := v_deleted_count + 1;
        v_deleted := v_deleted || jsonb_build_array(
          jsonb_build_object('user_id', v_row.user_id, 'email', v_row.email)
        );
      else
        v_failed_count := v_failed_count + 1;
        v_failed := v_failed || jsonb_build_array(
          jsonb_build_object(
            'user_id', v_row.user_id,
            'error', coalesce(v_result->>'error', 'delete_user_completely failed')
          )
        );
      end if;
    exception
      when others then
        v_failed_count := v_failed_count + 1;
        v_failed := v_failed || jsonb_build_array(
          jsonb_build_object('user_id', v_row.user_id, 'error', sqlerrm)
        );
    end;
  end loop;

  insert into public.inactive_account_cleanup_log (dry_run, candidates, deleted_users, failed_users, summary)
  values (
    false,
    v_candidates,
    v_deleted,
    v_failed,
    jsonb_build_object(
      'ran_at', v_now,
      'mode', 'live',
      'cutoff', v_cutoff,
      'deleted_count', v_deleted_count,
      'failed_count', v_failed_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'dry_run', false,
    'ran_at', v_now,
    'cutoff', v_cutoff,
    'deleted_count', v_deleted_count,
    'failed_count', v_failed_count,
    'deleted_users', v_deleted,
    'failed_users', v_failed
  );
end;
$$;

revoke all on function public.run_inactive_account_cleanup() from public;
grant execute on function public.run_inactive_account_cleanup() to service_role;

-- ---------------------------------------------------------------------------
-- Admin review (no access for anon/authenticated clients)
-- ---------------------------------------------------------------------------
create or replace view public.admin_user_inactivity_review as
select
  p.id as user_id,
  p.email,
  p.full_name as display_name,
  p.subscription_status,
  p.last_login_at,
  public.user_has_future_boatmatey_reminder(p.id) as has_future_reminder,
  (
    lower(trim(coalesce(p.subscription_status, ''))) <> 'active'
    and coalesce(p.last_login_at, p.created_at, '-infinity'::timestamptz)
      < (timezone('utc', now()) - interval '90 days')
    and not public.user_has_future_boatmatey_reminder(p.id)
  ) as deletion_eligible,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at
from public.profiles p;

revoke all on public.admin_user_inactivity_review from public;
revoke all on public.admin_user_inactivity_review from anon;
revoke all on public.admin_user_inactivity_review from authenticated;
grant select on public.admin_user_inactivity_review to service_role;

comment on view public.admin_user_inactivity_review is
  'Admin-only: email, subscription, last_login_at, future reminders, cleanup eligibility. Query as service_role or postgres in SQL editor.';

-- ---------------------------------------------------------------------------
-- Schedule: daily 04:30 UTC (after GDPR pass at 03:15)
-- ---------------------------------------------------------------------------
do $cron$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'daily_inactive_account_cleanup'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'daily_inactive_account_cleanup',
    '30 4 * * *',
    $j$select public.run_inactive_account_cleanup();$j$
  );
end
$cron$;

-- Switch to LIVE deletion (run in SQL editor as superuser):
--   update public.cleanup_job_settings
--   set dry_run = false, updated_at = timezone('utc', now())
--   where job_name = 'inactive_account_cleanup';
-- Re-enable safe preview:
--   update public.cleanup_job_settings set dry_run = true where job_name = 'inactive_account_cleanup';
