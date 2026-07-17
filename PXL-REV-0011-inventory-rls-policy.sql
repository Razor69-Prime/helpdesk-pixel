-- PXL-REV-0011
-- Fix RLS policy untuk modul Inventory
-- Project menggunakan autentikasi aplikasi melalui backend Express.
-- Policy dibatasi hanya pada tabel Inventory dan tidak mengubah tabel modul lain.

begin;

-- Helper: inventory_items
do $$
begin
  if to_regclass('public.inventory_items') is not null then
    alter table public.inventory_items enable row level security;

    grant select, insert, update, delete on table public.inventory_items to anon, authenticated;

    drop policy if exists "inventory_items_select_app" on public.inventory_items;
    drop policy if exists "inventory_items_insert_app" on public.inventory_items;
    drop policy if exists "inventory_items_update_app" on public.inventory_items;
    drop policy if exists "inventory_items_delete_app" on public.inventory_items;

    create policy "inventory_items_select_app"
      on public.inventory_items
      for select
      to anon, authenticated
      using (true);

    create policy "inventory_items_insert_app"
      on public.inventory_items
      for insert
      to anon, authenticated
      with check (true);

    create policy "inventory_items_update_app"
      on public.inventory_items
      for update
      to anon, authenticated
      using (true)
      with check (true);

    create policy "inventory_items_delete_app"
      on public.inventory_items
      for delete
      to anon, authenticated
      using (true);
  end if;
end $$;

-- inventory_transactions
do $$
begin
  if to_regclass('public.inventory_transactions') is not null then
    alter table public.inventory_transactions enable row level security;

    grant select, insert, update, delete on table public.inventory_transactions to anon, authenticated;

    drop policy if exists "inventory_transactions_select_app" on public.inventory_transactions;
    drop policy if exists "inventory_transactions_insert_app" on public.inventory_transactions;
    drop policy if exists "inventory_transactions_update_app" on public.inventory_transactions;
    drop policy if exists "inventory_transactions_delete_app" on public.inventory_transactions;

    create policy "inventory_transactions_select_app"
      on public.inventory_transactions
      for select
      to anon, authenticated
      using (true);

    create policy "inventory_transactions_insert_app"
      on public.inventory_transactions
      for insert
      to anon, authenticated
      with check (true);

    create policy "inventory_transactions_update_app"
      on public.inventory_transactions
      for update
      to anon, authenticated
      using (true)
      with check (true);

    create policy "inventory_transactions_delete_app"
      on public.inventory_transactions
      for delete
      to anon, authenticated
      using (true);
  end if;
end $$;

-- inventory_opnames
do $$
begin
  if to_regclass('public.inventory_opnames') is not null then
    alter table public.inventory_opnames enable row level security;

    grant select, insert, update, delete on table public.inventory_opnames to anon, authenticated;

    drop policy if exists "inventory_opnames_select_app" on public.inventory_opnames;
    drop policy if exists "inventory_opnames_insert_app" on public.inventory_opnames;
    drop policy if exists "inventory_opnames_update_app" on public.inventory_opnames;
    drop policy if exists "inventory_opnames_delete_app" on public.inventory_opnames;

    create policy "inventory_opnames_select_app"
      on public.inventory_opnames
      for select
      to anon, authenticated
      using (true);

    create policy "inventory_opnames_insert_app"
      on public.inventory_opnames
      for insert
      to anon, authenticated
      with check (true);

    create policy "inventory_opnames_update_app"
      on public.inventory_opnames
      for update
      to anon, authenticated
      using (true)
      with check (true);

    create policy "inventory_opnames_delete_app"
      on public.inventory_opnames
      for delete
      to anon, authenticated
      using (true);
  end if;
end $$;

-- inventory_opname_items
do $$
begin
  if to_regclass('public.inventory_opname_items') is not null then
    alter table public.inventory_opname_items enable row level security;

    grant select, insert, update, delete on table public.inventory_opname_items to anon, authenticated;

    drop policy if exists "inventory_opname_items_select_app" on public.inventory_opname_items;
    drop policy if exists "inventory_opname_items_insert_app" on public.inventory_opname_items;
    drop policy if exists "inventory_opname_items_update_app" on public.inventory_opname_items;
    drop policy if exists "inventory_opname_items_delete_app" on public.inventory_opname_items;

    create policy "inventory_opname_items_select_app"
      on public.inventory_opname_items
      for select
      to anon, authenticated
      using (true);

    create policy "inventory_opname_items_insert_app"
      on public.inventory_opname_items
      for insert
      to anon, authenticated
      with check (true);

    create policy "inventory_opname_items_update_app"
      on public.inventory_opname_items
      for update
      to anon, authenticated
      using (true)
      with check (true);

    create policy "inventory_opname_items_delete_app"
      on public.inventory_opname_items
      for delete
      to anon, authenticated
      using (true);
  end if;
end $$;

commit;