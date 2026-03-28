-- Track last successful sign-in / session use for inactive-account cleanup (90-day rule).
-- Client calls public.touch_last_login_at() after confirmed auth; server throttles updates.

alter table public.profiles
  add column if not exists last_login_at timestamptz null;

comment on column public.profiles.last_login_at is
  'UTC timestamp of last successful login or restored session (updated via touch_last_login_at, throttled).';

-- Backfill from Supabase Auth — real activity only (no fabricated "now").
update public.profiles p
set last_login_at = coalesce(u.last_sign_in_at, u.created_at)
from auth.users u
where p.id = u.id
  and p.last_login_at is null;

create or replace function public.touch_last_login_at()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_min_interval interval := interval '6 hours';
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

revoke all on function public.touch_last_login_at() from public;
grant execute on function public.touch_last_login_at() to authenticated;
grant execute on function public.touch_last_login_at() to service_role;
