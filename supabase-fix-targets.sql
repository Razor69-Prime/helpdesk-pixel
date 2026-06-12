-- ═══════════════════════════════════════════════════════
--  FIX: Sales Targets — pastikan tabel + unique constraint ada
--  Jalankan di: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════

create table if not exists sales_targets (
  id            uuid default gen_random_uuid() primary key,
  sales_pic     text not null,
  year_month    text not null,
  target_amount numeric(15,2) not null,
  updated_at    timestamptz default now(),
  updated_by    text
);

-- Pastikan unique constraint ada (untuk upsert on_conflict)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_targets_pic_month_unique'
  ) then
    alter table sales_targets add constraint sales_targets_pic_month_unique unique (sales_pic, year_month);
  end if;
end $$;

alter table sales_targets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='sales_targets' and policyname='anon_all_sales_targets') then
    execute 'create policy "anon_all_sales_targets" on sales_targets for all using (true) with check (true)';
  end if;
end $$;
