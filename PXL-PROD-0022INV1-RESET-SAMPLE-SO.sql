-- PXL-PROD-0022INV1
-- Reset nominal sample SO-2026-000001 / customer I Made Sukadana ke 0.
-- Customer CRM TIDAK dihapus; identitas/nama customer tetap dipertahankan.
-- Jalankan sekali di Supabase SQL Editor production setelah review.

begin;

-- Guard: pastikan target SO tepat satu record.
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.sales_orders where so_number='SO-2026-000001';
  if v_count <> 1 then
    raise exception 'ABORT: SO-2026-000001 ditemukan % record (harus tepat 1).', v_count;
  end if;
end $$;

-- 1) Sales Order header: semua nominal agregat menjadi 0.
update public.sales_orders
set total_amount=0,
    material_subtotal=0,
    service_subtotal=0,
    quotation_total=0
where so_number='SO-2026-000001';

-- Kolom nominal tambahan yang mungkin berasal dari revisi PPN terbaru.
do $$
declare c text;
begin
  foreach c in array array['subtotal_amount','subtotal','grand_total','ppn_total','ppn_amount','tax_amount','discount_total','discount_amount'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='sales_orders' and column_name=c) then
      execute format('update public.sales_orders set %I=0 where so_number=$1',c) using 'SO-2026-000001';
    end if;
  end loop;
end $$;

-- 2) Snapshot quotation/revisi SO: nominal 0 agar history tidak membuat discrepancy.
update public.sales_order_quotation_revisions
set material_subtotal=0,
    service_subtotal=0,
    grand_total=0
where so_number='SO-2026-000001';

-- 3) Invoice yang bersumber dari SO target: header + line nominal menjadi 0.
do $$
declare v_so uuid;
begin
  select id into v_so from public.sales_orders where so_number='SO-2026-000001';

  update public.invoice_items i
  set unit_price=0,
      line_total=0
  where i.invoice_id in (select id from public.invoices where source_so_id=v_so);

  update public.invoices
  set subtotal_amount=0,
      item_discount_amount=0,
      invoice_discount_amount=0,
      hg_amount=0,
      dpp_amount=0,
      ppn_amount=0,
      pph_amount=0,
      total_amount=0,
      paid_amount=0,
      balance_amount=0
  where source_so_id=v_so;
end $$;

-- 4) CRM Customer 360: transaksi SO tetap ada agar nama/customer history tidak hilang,
--    tetapi seluruh nominal transaksi dan line menjadi 0.
update public.crm_customer_transaction_lines
set unit_price=0,
    line_total=0
where sales_order_id=(select id from public.sales_orders where so_number='SO-2026-000001');

update public.crm_customer_transactions
set material_subtotal=0,
    service_subtotal=0,
    grand_total=0,
    updated_at=now()
where sales_order_id=(select id from public.sales_orders where so_number='SO-2026-000001');

-- 5) CRM invoice mirror (jika ada): pertahankan customer/name, reset hanya nominal.
do $$
declare c text; v_so uuid;
begin
  select id into v_so from public.sales_orders where so_number='SO-2026-000001';
  if exists(select 1 from information_schema.tables where table_schema='public' and table_name='crm_invoices') then
    foreach c in array array['subtotal_amount','subtotal','tax_amount','ppn_amount','total_amount','grand_total','paid_amount','balance_amount','remaining_amount'] loop
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='crm_invoices' and column_name=c) then
        if exists(select 1 from information_schema.columns where table_schema='public' and table_name='crm_invoices' and column_name='sales_order_id') then
          execute format('update public.crm_invoices set %I=0 where sales_order_id=$1',c) using v_so;
        elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name='crm_invoices' and column_name='so_number') then
          execute format('update public.crm_invoices set %I=0 where so_number=$1',c) using 'SO-2026-000001';
        end if;
      end if;
    end loop;
  end if;
end $$;

-- 6) Recompute ringkasan nominal customer dari transaksi CRM yang tersisa.
--    Nama dan master customer tidak disentuh.
update public.crm_customers c
set lifetime_value=coalesce((select sum(t.grand_total) from public.crm_customer_transactions t where t.customer_id=c.id and t.status='approved'),0),
    last_transaction_amount=coalesce((select t.grand_total from public.crm_customer_transactions t where t.customer_id=c.id and t.status='approved' order by t.transaction_at desc,t.created_at desc limit 1),0)
where c.id=(select customer_id from public.sales_orders where so_number='SO-2026-000001');

commit;

-- VERIFIKASI: hasil nominal target harus 0 dan customer tetap I Made Sukadana.
select so_number,customer_name,total_amount,material_subtotal,service_subtotal,quotation_total
from public.sales_orders where so_number='SO-2026-000001';

select c.name,c.lifetime_value,c.last_transaction_amount
from public.crm_customers c
where c.id=(select customer_id from public.sales_orders where so_number='SO-2026-000001');
