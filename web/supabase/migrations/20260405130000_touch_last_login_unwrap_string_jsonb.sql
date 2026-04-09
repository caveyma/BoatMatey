-- If p_client arrives as a JSON string containing a JSON object (double-encoded), unwrap to a real object.

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
  v_client jsonb;
begin
  if v_uid is null then
    return;
  end if;

  v_client := p_client;
  if v_client is not null and jsonb_typeof(v_client) = 'string' then
    begin
      v_client := (v_client #>> '{}')::jsonb;
    exception when others then
      return;
    end;
  end if;

  if v_client is null or jsonb_typeof(v_client) <> 'object' then
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
    last_sign_in_client = v_client || jsonb_build_object('recorded_at', v_now),
    updated_at = v_now
  where p.id = v_uid
    and (
      v_prev_ts is null
      or v_prev_ts < v_now - v_min_interval
      or coalesce(v_prev_ua, '') is distinct from coalesce(v_client->>'user_agent', '')
      or coalesce(v_prev_surface, '') is distinct from coalesce(v_client->>'client_surface', '')
    );
end;
$$;
