-- PXL-REV-0015
-- Perbaikan penghapusan Inventory agar atomik dan tetap menyimpan histori.
-- Jalankan melalui Supabase SQL Editor sebelum deploy source code.

begin;

create or replace function public.inventory_soft_delete(
  p_item_id uuid,
  p_actor text default 'System'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_stock numeric(14,2);
begin
  select * into v_item
  from public.inventory_items
  where id = p_item_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Barang tidak ditemukan.'
    );
  end if;

  if v_item.is_active is false then
    return jsonb_build_object(
      'ok', true,
      'id', v_item.id,
      'name', v_item.name,
      'already_deleted', true,
      'previous_stock', v_item.stock
    );
  end if;

  v_stock := coalesce(v_item.stock, 0);

  if v_stock <> 0 then
    insert into public.inventory_transactions (
      item_id,
      transaction_type,
      qty,
      balance_after,
      reference,
      notes,
      created_by
    ) values (
      v_item.id,
      'OPNAME',
      -v_stock,
      0,
      'Hapus Inventory',
      'Stok dinolkan dan item dinonaktifkan oleh Super Admin',
      coalesce(nullif(trim(p_actor), ''), 'System')
    );
  end if;

  update public.inventory_items
  set stock = 0,
      is_active = false,
      updated_at = now()
  where id = v_item.id;

  return jsonb_build_object(
    'ok', true,
    'id', v_item.id,
    'name', v_item.name,
    'previous_stock', v_stock,
    'stock', 0,
    'is_active', false
  );
exception
  when others then
    raise;
end;
$$;

revoke all on function public.inventory_soft_delete(uuid, text) from public;
grant execute on function public.inventory_soft_delete(uuid, text) to anon, authenticated, service_role;

commit;
