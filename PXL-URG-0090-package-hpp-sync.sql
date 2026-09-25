-- PXL-URG-0090 — Package Recipe inventory linkage for confirmed HPP refresh
alter table public.package_recipe_items
  add column if not exists inventory_item_id uuid;

create index if not exists idx_package_recipe_items_inventory_item_id
  on public.package_recipe_items(inventory_item_id);
