-- Marine asset inventory: flexible detail JSON and free-form categories (backward compatible).
-- Existing rows keep their category values; new sailing/motor categories are enforced in the app only.

alter table public.boat_inventory drop constraint if exists boat_inventory_category_check;

alter table public.boat_inventory
  add column if not exists detail jsonb not null default '{}'::jsonb;

comment on column public.boat_inventory.detail is 'Category-specific and lifecycle fields (condition, dates, sail/winch/rigging metadata).';
