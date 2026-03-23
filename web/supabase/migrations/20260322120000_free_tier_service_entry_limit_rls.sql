-- Free tier: allow at most one service_entries row per boat per owner unless the user has an active subscription on profiles.

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
        (select count(*)::int from public.service_entries se
         where se.boat_id = service_entries.boat_id
         and se.owner_id = (select auth.uid())) < 1
      )
    )
  );
