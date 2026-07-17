-- PXL-REV-0019
-- Restock scan counter untuk barang qty dan tracking Serial Number.

begin;

alter table public.inventory_items
  add column if not exists tracking_mode text not null default 'quantity';

alter table public.inventory_items
  drop constraint if exists inventory_items_tracking_mode_check;

alter table public.inventory_items
  add constraint inventory_items_tracking_mode_check
  check (tracking_mode in ('quantity','serial'));

create table if not exists public.inventory_item_serials (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  serial_number text not null,
  status text not null default 'in_stock',
  restock_reference text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(serial_number)
);

alter table public.inventory_item_serials
  drop constraint if exists inventory_item_serials_status_check;

alter table public.inventory_item_serials
  add constraint inventory_item_serials_status_check
  check (status in ('in_stock','issued','returned','damaged','inactive'));

create index if not exists inventory_item_serials_item_idx
  on public.inventory_item_serials(item_id,status);

grant select, insert, update on public.inventory_item_serials to anon, authenticated;
alter table public.inventory_item_serials enable row level security;

drop policy if exists inventory_item_serials_select_app on public.inventory_item_serials;
create policy inventory_item_serials_select_app
  on public.inventory_item_serials for select to anon, authenticated using(true);

drop policy if exists inventory_item_serials_insert_app on public.inventory_item_serials;
create policy inventory_item_serials_insert_app
  on public.inventory_item_serials for insert to anon, authenticated with check(true);

drop policy if exists inventory_item_serials_update_app on public.inventory_item_serials;
create policy inventory_item_serials_update_app
  on public.inventory_item_serials for update to anon, authenticated using(true) with check(true);

create or replace function public.inventory_restock_batch(
  p_item_id uuid,
  p_qty numeric,
  p_serial_numbers text[] default array[]::text[],
  p_reference text default 'Restock',
  p_actor text default 'System'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_qty numeric;
  v_balance numeric;
  v_serial text;
  v_count integer := 0;
begin
  select * into v_item
  from public.inventory_items
  where id=p_item_id and is_active=true
  for update;

  if not found then
    raise exception 'Barang tidak ditemukan atau sudah tidak aktif.';
  end if;

  if v_item.tracking_mode='serial' then
    v_qty := coalesce(array_length(p_serial_numbers,1),0);
    if v_qty <= 0 then
      raise exception 'Barang serial wajib memiliki minimal satu Serial Number.';
    end if;

    if (select count(*) from unnest(p_serial_numbers) s where btrim(s) <> '') <> v_qty then
      raise exception 'Serial Number tidak boleh kosong.';
    end if;

    if (select count(distinct lower(btrim(s))) from unnest(p_serial_numbers) s) <> v_qty then
      raise exception 'Terdapat Serial Number duplikat dalam sesi restock.';
    end if;

    foreach v_serial in array p_serial_numbers loop
      if exists(select 1 from public.inventory_item_serials where lower(serial_number)=lower(btrim(v_serial))) then
        raise exception 'Serial Number % sudah terdaftar.', v_serial;
      end if;
      insert into public.inventory_item_serials(item_id,serial_number,status,restock_reference,created_by)
      values(p_item_id,btrim(v_serial),'in_stock',nullif(btrim(p_reference),''),p_actor);
      v_count := v_count + 1;
    end loop;
  else
    v_qty := coalesce(p_qty,0);
    if v_qty <= 0 then
      raise exception 'Qty restock harus lebih dari 0.';
    end if;
  end if;

  v_balance := coalesce(v_item.stock,0) + v_qty;

  update public.inventory_items
  set stock=v_balance, updated_at=now()
  where id=p_item_id;

  insert into public.inventory_transactions(
    id,item_id,transaction_type,qty,balance_after,reference,notes,created_by,created_at
  ) values(
    gen_random_uuid(),p_item_id,'RESTOCK',v_qty,v_balance,
    coalesce(nullif(btrim(p_reference),''),'Restock'),
    case when v_item.tracking_mode='serial'
      then 'Restock serial: ' || v_count || ' SN unik'
      else 'Restock qty batch'
    end,
    p_actor,now()
  );

  return jsonb_build_object(
    'ok',true,
    'item_id',p_item_id,
    'tracking_mode',v_item.tracking_mode,
    'qty',v_qty,
    'balance_after',v_balance,
    'serial_count',v_count
  );
exception when others then
  return jsonb_build_object('ok',false,'error',sqlerrm);
end;
$$;

grant execute on function public.inventory_restock_batch(uuid,numeric,text[],text,text) to anon, authenticated;

commit;
-- PXL-REV-0021
-- Hapus Material Request khusus Super Admin dengan pengembalian stok Inventory atomik.

begin;

create or replace function public.inventory_delete_material_request(
  p_request_id uuid,
  p_actor text default 'System'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_mr public.material_request_forms%rowtype;
  v_tx record;
  v_item public.inventory_items%rowtype;
  v_restore numeric(14,2);
  v_balance numeric(14,2);
  v_restored integer := 0;
begin
  select * into v_mr
  from public.material_request_forms
  where id=p_request_id
  for update;

  if not found then
    raise exception 'Material Request tidak ditemukan atau sudah dihapus.';
  end if;

  -- Kembalikan seluruh stok yang sebelumnya dikeluarkan oleh request ini.
  for v_tx in
    select *
    from public.inventory_transactions
    where transaction_type='REQUEST'
      and notes like '%ID ' || p_request_id::text || '%'
    order by created_at asc
  loop
    v_restore := abs(coalesce(v_tx.qty,0));
    if v_restore <= 0 then
      continue;
    end if;

    select * into v_item
    from public.inventory_items
    where id=v_tx.item_id
    for update;

    if not found then
      raise exception 'Item Inventory untuk transaksi Material Request tidak ditemukan.';
    end if;

    v_balance := coalesce(v_item.stock,0) + v_restore;

    update public.inventory_items
    set stock=v_balance, updated_at=now()
    where id=v_item.id;

    insert into public.inventory_transactions(
      id,item_id,transaction_type,qty,balance_after,reference,notes,created_by,created_at
    ) values (
      gen_random_uuid(),v_item.id,'RETURN',v_restore,v_balance,
      'Pembatalan MR ' || coalesce(nullif(v_mr.wo_number,''),p_request_id::text),
      'Pengembalian otomatis karena Material Request dihapus · ID ' || p_request_id::text,
      p_actor,now()
    );

    v_restored := v_restored + 1;
  end loop;

  delete from public.material_request_forms where id=p_request_id;

  return jsonb_build_object(
    'ok',true,
    'request_id',p_request_id,
    'wo_number',v_mr.wo_number,
    'restored_items',v_restored
  );
exception when others then
  raise;
end;
$$;

grant execute on function public.inventory_delete_material_request(uuid,text)
  to anon, authenticated, service_role;

commit;
