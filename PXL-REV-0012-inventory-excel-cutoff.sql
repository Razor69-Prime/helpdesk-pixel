-- PXL-REV-0012
-- Import Cut Off Inventory secara atomik melalui Supabase RPC.
-- Jalankan satu kali di Supabase SQL Editor sebelum menggunakan tombol Import Cut Off.

begin;

create or replace function public.inventory_apply_cutoff(
  p_rows jsonb,
  p_actor text default 'System'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_item public.inventory_items%rowtype;
  v_name text;
  v_pn text;
  v_barcode text;
  v_category text;
  v_unit text;
  v_stock numeric(14,2);
  v_min numeric(14,2);
  v_diff numeric(14,2);
  v_created integer := 0;
  v_updated integer := 0;
  v_adjusted integer := 0;
  v_processed integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Data import kosong.';
  end if;

  if jsonb_array_length(p_rows) > 3000 then
    raise exception 'Maksimum 3.000 baris per import.';
  end if;

  for r in select value from jsonb_array_elements(p_rows)
  loop
    v_name := btrim(coalesce(r->>'name', ''));
    v_pn := nullif(btrim(coalesce(r->>'product_number', '')), '');
    v_barcode := nullif(btrim(coalesce(r->>'barcode', '')), '');
    v_category := coalesce(nullif(btrim(r->>'category'), ''), 'Aksesoris');
    v_unit := lower(coalesce(nullif(btrim(r->>'unit'), ''), 'pcs'));

    begin
      v_stock := (r->>'stock')::numeric;
      v_min := coalesce(nullif(r->>'min_stock', '')::numeric, 0);
    exception when others then
      raise exception 'Nilai stok tidak valid pada barang %.', coalesce(nullif(v_name,''), '(tanpa nama)');
    end;

    if v_name = '' then raise exception 'Nama Barang wajib diisi.'; end if;
    if v_stock < 0 then raise exception 'Stok Cut Off % tidak boleh negatif.', v_name; end if;
    if v_min < 0 then raise exception 'Minimum Stok % tidak boleh negatif.', v_name; end if;

    v_item := null;

    if v_pn is not null then
      select * into v_item from public.inventory_items
      where lower(product_number) = lower(v_pn)
      limit 1;
    end if;

    if v_item.id is null and v_barcode is not null then
      select * into v_item from public.inventory_items
      where lower(barcode) = lower(v_barcode)
      limit 1;
    end if;

    if v_item.id is null then
      select * into v_item from public.inventory_items
      where lower(name) = lower(v_name) and is_active = true
      order by created_at asc
      limit 1;
    end if;

    -- Cegah Product Number / Barcode mengambil milik item lain.
    if v_pn is not null and exists (
      select 1 from public.inventory_items x
      where lower(x.product_number) = lower(v_pn)
        and (v_item.id is null or x.id <> v_item.id)
    ) then
      raise exception 'Product Number % sudah digunakan barang lain.', v_pn;
    end if;

    if v_barcode is not null and exists (
      select 1 from public.inventory_items x
      where lower(x.barcode) = lower(v_barcode)
        and (v_item.id is null or x.id <> v_item.id)
    ) then
      raise exception 'Barcode % sudah digunakan barang lain.', v_barcode;
    end if;

    if v_item.id is null then
      insert into public.inventory_items(
        name, product_number, barcode, category, unit, stock, min_stock, is_active
      ) values (
        v_name,
        v_pn,
        coalesce(v_barcode, 'PXL-INV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
        v_category,
        v_unit,
        v_stock,
        v_min,
        true
      ) returning * into v_item;

      if v_stock <> 0 then
        insert into public.inventory_transactions(
          item_id, transaction_type, qty, balance_after, reference, notes, created_by
        ) values (
          v_item.id, 'RESTOCK', v_stock, v_stock,
          'Import Cut Off Excel', 'Stok awal dari import cut off', p_actor
        );
        v_adjusted := v_adjusted + 1;
      end if;
      v_created := v_created + 1;
    else
      v_diff := v_stock - coalesce(v_item.stock, 0);

      update public.inventory_items
      set name = v_name,
          product_number = v_pn,
          barcode = coalesce(v_barcode, barcode),
          category = v_category,
          unit = v_unit,
          stock = v_stock,
          min_stock = v_min,
          is_active = true,
          updated_at = now()
      where id = v_item.id
      returning * into v_item;

      if v_diff <> 0 then
        insert into public.inventory_transactions(
          item_id, transaction_type, qty, balance_after, reference, notes, created_by
        ) values (
          v_item.id, 'OPNAME', v_diff, v_stock,
          'Import Cut Off Excel', 'Penyesuaian saldo melalui import Excel', p_actor
        );
        v_adjusted := v_adjusted + 1;
      end if;
      v_updated := v_updated + 1;
    end if;

    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'created', v_created,
    'updated', v_updated,
    'adjusted', v_adjusted
  );
end;
$$;

grant execute on function public.inventory_apply_cutoff(jsonb, text) to anon, authenticated, service_role;

commit;
