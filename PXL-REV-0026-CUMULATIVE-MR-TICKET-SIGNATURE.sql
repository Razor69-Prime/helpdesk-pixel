-- PXL-REV-0025
-- Rumus pemakaian/pengembalian Material Request dan pengembalian stok Inventory atomik.
-- Pengembalian = Pengambilan - Pemakaian.

begin;

alter table public.material_request_forms
  add column if not exists requester_signature text,
  add column if not exists requester_signed_by text,
  add column if not exists requester_signed_at timestamptz,
  add column if not exists technician_signature text,
  add column if not exists technician_signed_by text,
  add column if not exists technician_signed_at timestamptz,
  add column if not exists prepared_signature text,
  add column if not exists prepared_by text,
  add column if not exists prepared_at timestamptz;

create or replace function public.inventory_update_material_request_usage(
  p_request_id uuid,
  p_items jsonb,
  p_actor text default 'System',
  p_date_return date default null,
  p_technician text default null,
  p_technician_signature text default null,
  p_technician_signed_by text default null,
  p_technician_signed_at timestamptz default null,
  p_prepared_by text default null,
  p_prepared_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_mr public.material_request_forms%rowtype;
  r jsonb;
  old_r jsonb;
  v_item public.inventory_items%rowtype;
  v_item_id uuid;
  v_qty_out numeric(14,2);
  v_qty_use numeric(14,2);
  v_qty_return numeric(14,2);
  v_old_return numeric(14,2);
  v_delta numeric(14,2);
  v_balance numeric(14,2);
  v_normalized jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Daftar item Material Request tidak valid.';
  end if;

  select * into v_mr
  from public.material_request_forms
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Material Request tidak ditemukan.';
  end if;

  if nullif(btrim(coalesce(p_prepared_by,'')),'') is not null then
    if not exists (
      select 1 from public.users
      where lower(name)=lower(btrim(p_prepared_by))
        and role in ('admin','accounting','manager')
        and coalesce(is_active,true)=true
    ) then
      raise exception 'Material Prepare hanya boleh Admin, Akunting, atau Manager aktif.';
    end if;
  end if;

  for r in select value from jsonb_array_elements(p_items)
  loop
    v_qty_out := coalesce(nullif(r->>'qty_out','')::numeric,0);
    v_qty_use := coalesce(nullif(r->>'qty_use','')::numeric,0);

    if v_qty_out <= 0 then
      raise exception 'Jumlah pengambilan % harus lebih dari 0.', coalesce(r->>'name','item');
    end if;
    if v_qty_use < 0 or v_qty_use > v_qty_out then
      raise exception 'Pemakaian % harus antara 0 dan jumlah pengambilan.', coalesce(r->>'name','item');
    end if;

    v_qty_return := v_qty_out - v_qty_use;
    v_item_id := nullif(r->>'inventory_item_id','')::uuid;
    v_old_return := 0;

    if v_item_id is not null then
      select value into old_r
      from jsonb_array_elements(coalesce(v_mr.items,'[]'::jsonb))
      where nullif(value->>'inventory_item_id','')::uuid = v_item_id
      limit 1;

      if old_r is not null then
        v_old_return := coalesce(nullif(old_r->>'qty_return','')::numeric,0);
      end if;

      v_delta := v_qty_return - v_old_return;

      if v_delta <> 0 then
        select * into v_item
        from public.inventory_items
        where id=v_item_id and is_active=true
        for update;

        if not found then
          raise exception 'Item Inventory % tidak ditemukan atau tidak aktif.', coalesce(r->>'name',v_item_id::text);
        end if;

        if v_delta < 0 and coalesce(v_item.stock,0) < abs(v_delta) then
          raise exception 'Stok % tidak cukup untuk koreksi pemakaian. Tersedia % %, dibutuhkan % %.',
            v_item.name,v_item.stock,v_item.unit,abs(v_delta),v_item.unit;
        end if;

        v_balance := coalesce(v_item.stock,0) + v_delta;
        update public.inventory_items
        set stock=v_balance, updated_at=now()
        where id=v_item_id;

        insert into public.inventory_transactions(
          id,item_id,transaction_type,qty,balance_after,reference,notes,created_by,created_at
        ) values (
          gen_random_uuid(),v_item_id,
          case when v_delta > 0 then 'RETURN' else 'REQUEST' end,
          v_delta,v_balance,
          'MR ' || coalesce(nullif(v_mr.wo_number,''),p_request_id::text),
          case when v_delta > 0
            then 'Pengembalian sisa material · Pengambilan '||v_qty_out||' - Pemakaian '||v_qty_use||' · ID '||p_request_id::text
            else 'Koreksi tambahan pemakaian material · ID '||p_request_id::text
          end,
          coalesce(nullif(p_actor,''),'System'),now()
        );
      end if;
    end if;

    r := jsonb_set(r,'{qty_out}',to_jsonb(v_qty_out),true);
    r := jsonb_set(r,'{qty_use}',to_jsonb(v_qty_use),true);
    r := jsonb_set(r,'{qty_return}',to_jsonb(v_qty_return),true);
    v_normalized := v_normalized || jsonb_build_array(r);
    v_count := v_count + 1;
  end loop;

  update public.material_request_forms
  set items=v_normalized,
      status='returned',
      date_return=coalesce(p_date_return,current_date),
      technician=coalesce(nullif(btrim(p_technician),''),nullif(btrim(p_actor),''),technician),
      technician_signature=coalesce(p_technician_signature,technician_signature),
      technician_signed_by=coalesce(nullif(btrim(p_technician_signed_by),''),technician_signed_by),
      technician_signed_at=coalesce(p_technician_signed_at,technician_signed_at),
      prepared_by=nullif(btrim(coalesce(p_prepared_by,'')),''),
      prepared_at=case when nullif(btrim(coalesce(p_prepared_by,'')),'') is null then null else coalesce(p_prepared_at,now()) end
  where id=p_request_id;

  return jsonb_build_object(
    'ok',true,
    'request_id',p_request_id,
    'items',v_normalized,
    'item_count',v_count,
    'status','returned'
  );
exception when others then
  raise;
end;
$$;

grant execute on function public.inventory_update_material_request_usage(
  uuid,jsonb,text,date,text,text,text,timestamptz,text,timestamptz
) to anon,authenticated,service_role;

-- Ticket completion signatures and audited bypass.
alter table public.tickets
  add column if not exists tech_signature text,
  add column if not exists customer_signature text,
  add column if not exists signature_bypass boolean not null default false,
  add column if not exists signature_bypass_reason text,
  add column if not exists signature_bypassed_by text,
  add column if not exists signature_bypassed_at timestamptz;

create index if not exists idx_tickets_signature_bypass
  on public.tickets(signature_bypass)
  where signature_bypass=true;

commit;
