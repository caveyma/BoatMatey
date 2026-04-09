-- last_login_at: last time the user opened a boat dashboard (meaningful app use).
-- last_sign_in_client: snapshot from the client when a session is established (device / browser / native shell).

alter table public.profiles
  add column if not exists last_sign_in_client jsonb null;

comment on column public.profiles.last_login_at is
  'UTC timestamp of last boat dashboard open (touch_boat_dashboard_open). Used for inactive-account cleanup.';

comment on column public.profiles.last_sign_in_client is
  'Client snapshot: client_surface (web|ios|android), summary, browser/os (web), optional user_agent, recorded_at.';

drop function if exists public.touch_last_login_at();

create or replace function public.touch_last_login_at(p_client jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_min_interval interval := interval '6 hours';
  v_prev_ts timestamptz;
  v_prev_ua text;
  v_prev_surface text;
begin
  if v_uid is null then
    return;
  end if;

  if p_client is null or jsonb_typeof(p_client) <> 'object' then
    return;
  end if;

  v_prev_ts := null;
  v_prev_ua := null;
  v_prev_surface := null;
  select
    case
      when p.last_sign_in_client ? 'recorded_at'
        and nullif(trim(p.last_sign_in_client->>'recorded_at'), '') is not null
      then (p.last_sign_in_client->>'recorded_at')::timestamptz
      else null
    end,
    coalesce(p.last_sign_in_client->>'user_agent', ''),
    coalesce(p.last_sign_in_client->>'client_surface', '')
  into v_prev_ts, v_prev_ua, v_prev_surface
  from public.profiles p
  where p.id = v_uid;

  update public.profiles p
  set
    last_sign_in_client = p_client || jsonb_build_object('recorded_at', v_now),
    updated_at = v_now
  where p.id = v_uid
    and (
      v_prev_ts is null
      or v_prev_ts < v_now - v_min_interval
      or coalesce(v_prev_ua, '') is distinct from coalesce(p_client->>'user_agent', '')
      or coalesce(v_prev_surface, '') is distinct from coalesce(p_client->>'client_surface', '')
    );
end;
$$;

revoke all on function public.touch_last_login_at(jsonb) from public;
grant execute on function public.touch_last_login_at(jsonb) to authenticated;
grant execute on function public.touch_last_login_at(jsonb) to service_role;

create or replace function public.touch_boat_dashboard_open()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_min_interval interval := interval '1 minute';
begin
  if v_uid is null then
    return;
  end if;

  update public.profiles p
  set
    last_login_at = v_now,
    updated_at = v_now
  where p.id = v_uid
    and (
      p.last_login_at is null
      or p.last_login_at < v_now - v_min_interval
    );
end;
$$;

revoke all on function public.touch_boat_dashboard_open() from public;
grant execute on function public.touch_boat_dashboard_open() to authenticated;
grant execute on function public.touch_boat_dashboard_open() to service_role;
