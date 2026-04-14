-- Extend service<->inventory links with item-level stock usage controls.

alter table if exists public.service_inventory_links
  add column if not exists quantity_used numeric null,
  add column if not exists affects_stock boolean not null default false;

-- Keep invalid values out of the table.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_inventory_links_quantity_used_positive'
  ) then
    alter table public.service_inventory_links
      add constraint service_inventory_links_quantity_used_positive
      check (quantity_used is null or quantity_used > 0);
  end if;
end $$;
