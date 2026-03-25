-- Allow owners to update attachment rows (e.g. re-key entity_id after a haul-out record gets a server UUID).
drop policy if exists attachments_update_own on public.attachments;
create policy attachments_update_own on public.attachments for update
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.boats b
      where b.id = boat_id and b.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.boats b
      where b.id = boat_id and b.owner_id = (select auth.uid())
    )
  );
