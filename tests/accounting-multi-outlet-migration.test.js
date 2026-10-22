'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const migration=path.join(__dirname,'..','PXL-ACC-0002-MIGRATION.sql');
assert.ok(fs.existsSync(migration),'PXL-ACC-0002-MIGRATION.sql must exist');
const sql=fs.readFileSync(migration,'utf8');
const norm=sql.replace(/\s+/g,' ').toLowerCase();
assert.match(norm,/create table if not exists public\.accounting_outlets/);
for(const code of ['buduk','lukluk','bangli']) assert.match(norm,new RegExp(`'${code}'`));
for(const table of ['accounting_sales_transactions','accounting_customers','accounting_pics','accounting_product_categories','accounting_payment_methods']){
  assert.match(norm,new RegExp(`alter table public\\.${table} add column if not exists outlet_id uuid`));
}
assert.match(norm,/foreign key \(outlet_id\) references public\.accounting_outlets\(id\)/);
assert.match(norm,/accounting_sales_transactions_outlet_period_idx.*outlet_id.*transaction_date/);
for(const table of ['accounting_customers','accounting_pics','accounting_product_categories','accounting_payment_methods']){
  assert.match(norm,new RegExp(`create unique index if not exists ${table}_outlet_name_ci_uq on public\\.${table}\\(outlet_id, lower\\(name\\)\\)`));
}
assert.match(norm,/raise exception 'pxl-acc-0002 unsafe migration: unmapped accounting transactions exist'/);
assert.match(norm,/raise exception 'pxl-acc-0002 unsafe migration: unmapped accounting customers exist'/);
assert.match(norm,/raise exception 'pxl-acc-0002 unsafe migration: unmapped accounting pics exist'/);
assert.match(norm,/from pxl_acc_0002_categories s cross join public\.accounting_outlets o where o\.code in \('buduk','lukluk','bangli'\) and not exists/);
assert.match(norm,/from pxl_acc_0002_payments s cross join public\.accounting_outlets o where o\.code in \('buduk','lukluk','bangli'\) and not exists/);
assert.match(norm,/begin;/);
assert.match(norm,/commit;/);
console.log('Accounting multi-outlet migration structure tests complete');
