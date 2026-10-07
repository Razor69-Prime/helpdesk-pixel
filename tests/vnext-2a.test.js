const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const migration=path.join(root,'PXL-VNEXT-2A-MIGRATION.sql');

test('migration adds work_order_type and backfills by approved priority',()=>{
  assert.ok(fs.existsSync(migration));
  const sql=fs.readFileSync(migration,'utf8');
  assert.match(sql,/add column if not exists work_order_type text/i);
  assert.match(sql,/Survey/i);
  assert.match(sql,/Project/i);
  assert.match(sql,/Operasional/i);
  assert.match(sql,/Unclassified/i);
  assert.match(sql,/crm_customers/i);
});

test('backend classifies WO with Survey > Project > Operasional > Unclassified',()=>{
  assert.match(server,/classifyWorkOrderType/);
  assert.match(server,/survey/i);
  assert.match(server,/kantor\\s\+desa|kantor desa/i);
  assert.match(server,/\bbpn\b/i);
  assert.match(server,/instalasi/i);
  assert.match(server,/maintenance/i);
  assert.match(server,/work_order_type/);
});

test('Input Laporan is renamed Input WO without changing report tab id',()=>{
  assert.doesNotMatch(index,/label:'📋 Input Laporan'/);
  assert.match(index,/label:'📋 Input WO'/);
  assert.match(index,/id:'report'/);
  assert.match(index,/Form Input Work Order/);
});
