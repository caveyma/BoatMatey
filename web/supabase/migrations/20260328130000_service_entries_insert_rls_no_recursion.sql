-- Fix 42P17 "infinite recursion detected in policy for relation service_entries":
-- The insert policy must not subquery public.service_entries directly (RLS re-enters the same table).
-- Use a SECURITY DEFINER helper so the count runs with owner privileges and bypasses RLS.

create or replace function public.count_service_entries_for_current_user_boat(p_boat_id uuid)
returns integer
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select count(*)::integer
  from public.service_entries se
  where se.boat_id = p_boat_id
    and se.owner_id = (select auth.uid());
$$;

comment on function public.count_service_entries_for_current_user_boat(uuid) is
  'RLS-safe count of service_entries for the current user and boat (for free-tier insert policy).';

revoke all on function public.count_service_entries_for_current_user_boat(uuid) from public;
grant execute on function public.count_service_entries_for_current_user_boat(uuid) to authenticated;
grant execute on function public.count_service_entries_for_current_user_boat(uuid) to service_role;

drop policy if exists service_entries_insert_own on public.service_entries;

create policy service_entries_insert_own on public.service_entries for insert
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.boats b
      where b.id = boat_id and b.owner_id = (select auth.uid())
    )
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
        and lower(coalesce(p.subscription_status, '')) = 'active'
      )
      or (
        public.count_service_entries_for_current_user_boat(boat_id) < 1
      )
    )
  );
