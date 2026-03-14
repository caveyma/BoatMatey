-- Boat inventory: onboard stock and low-level alerts.
-- Belongs to a boat; supports category, location, required/in-stock levels, critical spare flag, photo URL.

create table if not exists public.boat_inventory (
  id                     uuid primary key default gen_random_uuid(),
  boat_id                uuid not null references public.boats(id) on delete cascade,
  owner_id               uuid not null,
  name                   text not null,
  category               text null check (category in (
    'Engine','Electrical','Plumbing','Safety','Tools','Cleaning','Galley','Spares','Deck Gear','Misc'
  )),
  type                   text null,
  location               text null,
  position               text null,
  required_quantity      numeric null,
  in_stock_level         numeric null,
  part_number            text null,
  url                    text null,
  notes                  text null,
  photo_url              text null,
  supplier_brand         text null,
  critical_spare         boolean not null default false,
  last_restocked_date     date null,
  unit                   text null,
  created_at             timestamptz default timezone('utc', now()),
  updated_at             timestamptz default timezone('utc', now())
);

create index if not exists idx_boat_inventory_owner_id on public.boat_inventory(owner_id);
create index if not exists idx_boat_inventory_boat_id on public.boat_inventory(boat_id);
create index if not exists idx_boat_inventory_boat_category on public.boat_inventory(boat_id, category);

drop trigger if exists trg_boat_inventory_updated_at on public.boat_inventory;
create trigger trg_boat_inventory_updated_at
  before update on public.boat_inventory
  for each row
  execute procedure public.handle_updated_at();

alter table public.boat_inventory enable row level security;

drop policy if exists boat_inventory_select_own on public.boat_inventory;
drop policy if exists boat_inventory_insert_own on public.boat_inventory;
drop policy if exists boat_inventory_update_own on public.boat_inventory;
drop policy if exists boat_inventory_delete_own on public.boat_inventory;

create policy boat_inventory_select_own on public.boat_inventory for select
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

create policy boat_inventory_insert_own on public.boat_inventory for insert
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

create policy boat_inventory_update_own on public.boat_inventory for update
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));

create policy boat_inventory_delete_own on public.boat_inventory for delete
  using (owner_id = (select auth.uid()) and exists (select 1 from public.boats b where b.id = boat_id and b.owner_id = (select auth.uid())));
