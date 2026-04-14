-- Optional many-to-many links between service entries and boat inventory items.
-- Same-boat integrity enforced by RLS; cascade when service or inventory row is deleted.

create table if not exists public.service_inventory_links (
  id                  uuid primary key default gen_random_uuid(),
  service_id          uuid not null references public.service_entries(id) on delete cascade,
  inventory_item_id   uuid not null references public.boat_inventory(id) on delete cascade,
  owner_id            uuid not null,
  created_at          timestamptz not null default timezone('utc', now()),
  unique (service_id, inventory_item_id)
);

create index if not exists idx_service_inventory_links_service_id
  on public.service_inventory_links(service_id);
create index if not exists idx_service_inventory_links_inventory_item_id
  on public.service_inventory_links(inventory_item_id);
create index if not exists idx_service_inventory_links_owner_id
  on public.service_inventory_links(owner_id);

alter table public.service_inventory_links enable row level security;

drop policy if exists service_inventory_links_select_own on public.service_inventory_links;
drop policy if exists service_inventory_links_insert_own on public.service_inventory_links;
drop policy if exists service_inventory_links_delete_own on public.service_inventory_links;

-- Link visible when user owns the row and service + inventory belong to the same boat.
create policy service_inventory_links_select_own on public.service_inventory_links
  for select using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.service_entries se
      inner join public.boat_inventory bi
        on bi.id = service_inventory_links.inventory_item_id
       and bi.boat_id = se.boat_id
      where se.id = service_inventory_links.service_id
        and se.owner_id = (select auth.uid())
        and bi.owner_id = (select auth.uid())
    )
  );

create policy service_inventory_links_insert_own on public.service_inventory_links
  for insert with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.service_entries se
      inner join public.boat_inventory bi
        on bi.id = inventory_item_id
       and bi.boat_id = se.boat_id
      where se.id = service_id
        and se.owner_id = (select auth.uid())
        and bi.owner_id = (select auth.uid())
    )
  );

create policy service_inventory_links_delete_own on public.service_inventory_links
  for delete using (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.service_entries se
      inner join public.boat_inventory bi
        on bi.id = service_inventory_links.inventory_item_id
       and bi.boat_id = se.boat_id
      where se.id = service_inventory_links.service_id
        and se.owner_id = (select auth.uid())
        and bi.owner_id = (select auth.uid())
    )
  );
