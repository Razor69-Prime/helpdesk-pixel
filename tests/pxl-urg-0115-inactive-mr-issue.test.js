const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const migrationPath=path.join(root,'PXL-URG-0115-MIGRATION.sql');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');

test('SO options still expose active Inventory only',()=>{
  const start=server.indexOf("app.get('/api/sales-orders/options'");
  const end=server.indexOf("app.post('/api/sales-orders/:id/approve'",start);
  assert.ok(start>=0&&end>start,'SO options route must exist');
  const route=server.slice(start,end);
  assert.match(route,/getInventoryItems\(\)/);
  assert.match(route,/is_active!==false/);
});

test('inventory issue migration allows historical inactive Inventory IDs',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'PXL-URG-0115 migration must exist');
  const sql=fs.readFileSync(migrationPath,'utf8');
  assert.match(sql,/inventory_issue_material_request/);
  assert.doesNotMatch(sql,/where\s+id\s*=\s*v_id\s+and\s+is_active\s*=\s*true/i);
  assert.match(sql,/where\s+id\s*=\s*v_id\s+for\s+update/i);
});
