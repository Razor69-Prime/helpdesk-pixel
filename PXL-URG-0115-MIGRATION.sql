-- PXL-URG-0115 — MR existing tetap dapat issue item Inventory nonaktif
-- Tujuan: is_active hanya membatasi pilihan item baru, bukan memutus transaksi historis.

create or replace function public.inventory_issue_material_request(
  p_request_id uuid,
  p_items jsonb,
  p_actor text default 'System'::text,
  p_wo_number text default ''::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r jsonb;
  v_item public.inventory_items%rowtype;
  v_id uuid;
  v_qty numeric(14,2);
  v_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext(p_request_id::text));

  if exists (
    select 1
    from public.inventory_transactions
    where notes = 'Pengambilan melalui Form Material Request · ID ' || p_request_id::text
  ) then
    raise exception 'Material Request ini sudah pernah memotong stok Inventory.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Daftar item Inventory tidak valid.';
  end if;

  for r in select value from jsonb_array_elements(p_items)
  loop
    v_id := nullif(r->>'inventory_item_id','')::uuid;
    v_qty := coalesce(nullif(r->>'qty_out','')::numeric,0);

    if v_id is null or v_qty <= 0 then
      raise exception 'Item atau jumlah pengambilan tidak valid.';
    end if;

    -- PXL-URG-0115: item historis boleh tetap diproses walau is_active=false.
    -- is_active tetap dipakai di katalog/dropdown agar item nonaktif tidak dapat dipilih untuk transaksi baru.
    select *
    into v_item
    from public.inventory_items
    where id = v_id
    for update;

    if v_item.id is null then
      raise exception 'Item Inventory tidak ditemukan.';
    end if;

    if coalesce(v_item.stock,0) < v_qty then
      raise exception
        'Stok % tidak cukup. Tersedia % %, diminta % %.',
        v_item.name,
        v_item.stock,
        v_item.unit,
        v_qty,
        v_item.unit;
    end if;

    update public.inventory_items
    set
      stock = stock - v_qty,
      updated_at = now()
    where id = v_item.id;

    insert into public.inventory_transactions(
      item_id,
      transaction_type,
      qty,
      balance_after,
      reference,
      notes,
      created_by
    )
    values (
      v_item.id,
      'REQUEST',
      -v_qty,
      v_item.stock - v_qty,
      coalesce(nullif(p_wo_number,''),'Material Request'),
      'Pengambilan melalui Form Material Request · ID ' || p_request_id::text,
      p_actor
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'issued_items', v_count,
    'request_id', p_request_id
  );
end;
$function$;
