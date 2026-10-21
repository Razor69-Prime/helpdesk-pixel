const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const migration=fs.existsSync(path.join(root,'PXL-URG-0114-MIGRATION.sql'))?fs.readFileSync(path.join(root,'PXL-URG-0114-MIGRATION.sql'),'utf8'):'';

test('approved manual Project MR is atomically promoted to Project Report item for Input Today',()=>{
  assert.match(migration,/create or replace function public\.pxl_urg_0114_sync_manual_mr_report_items/);
  assert.match(migration,/source_type='manual'/);
  assert.match(migration,/status<>'approved'/);
  assert.match(migration,/insert into public\.project_report_items/);
  assert.match(migration,/category,item_name,boq_qty,unit,notes,sort_order/);
  assert.match(migration,/update public\.project_material_request_items/);
  assert.match(migration,/project_boq_item_id=v_report_item_id/);
  assert.match(migration,/create trigger pxl_urg_0114_manual_mr_report_sync/);
  assert.match(migration,/after update of status on public\.project_material_requests/);
  assert.match(migration,/new\.status='approved'/);
});

test('migration backfills already-approved manual Project MR items without merging equal names',()=>{
  assert.match(migration,/for v_request in[\s\S]*status='approved'/);
  assert.match(migration,/perform public\.pxl_urg_0114_sync_manual_mr_report_items\(v_request\.id/);
  assert.doesNotMatch(migration,/group by[\s\S]*item_name_snapshot/i);
});
