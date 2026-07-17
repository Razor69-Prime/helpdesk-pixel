-- PXL-REV-0016
-- Menghubungkan Form Material Request Teknisi dengan Inventory Asset.
-- Item yang dipilih melalui Barcode/SKU akan mengurangi stok dan membuat Log Stok secara atomik.

begin;

create or replace function public.inventory_issue_material_request(
  p_request_id uuid,
  p_items jsonb,
  p_actor text default 'System',
  p_wo_number text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r jsonb;
  v_item public.inventory_items%rowtype;
  v_id uuid;
  v_qty numeric(14,2);
  v_count integer:=0;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception 'Daftar item Inventory tidak valid.';
  end if;

  for r in select value from jsonb_array_elements(p_items)
  loop
    v_id:=nullif(r->>'inventory_item_id','')::uuid;
    v_qty:=coalesce(nullif(r->>'qty_out','')::numeric,0);
    if v_id is null or v_qty<=0 then
      raise exception 'Item atau jumlah pengambilan tidak valid.';
    end if;

    select * into v_item
    from public.inventory_items
    where id=v_id and is_active=true
    for update;

    if v_item.id is null then
      raise exception 'Item Inventory tidak ditemukan atau sudah tidak aktif.';
    end if;
    if coalesce(v_item.stock,0)<v_qty then
      raise exception 'Stok % tidak cukup. Tersedia % %, diminta % %.',v_item.name,v_item.stock,v_item.unit,v_qty,v_item.unit;
    end if;

    update public.inventory_items
    set stock=stock-v_qty,updated_at=now()
    where id=v_item.id;

    insert into public.inventory_transactions(
      item_id,transaction_type,qty,balance_after,reference,notes,created_by
    ) values (
      v_item.id,'REQUEST',-v_qty,v_item.stock-v_qty,
      coalesce(nullif(p_wo_number,''),'Material Request'),
      'Pengambilan melalui Form Material Request · ID '||p_request_id::text,
      p_actor
    );
    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'issued_items',v_count,'request_id',p_request_id);
exception when others then
  raise;
end;
$$;

grant execute on function public.inventory_issue_material_request(uuid,jsonb,text,text) to anon,authenticated,service_role;

-- Barcode barang yang sudah mempunyai SKU disamakan dengan SKU bila barcode lama kosong/otomatis.
update public.inventory_items
set barcode=sku,updated_at=now()
where sku is not null and trim(sku)<>''
  and (barcode is null or trim(barcode)='' or barcode like 'PXL-INV-%');

commit;
