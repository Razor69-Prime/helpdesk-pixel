const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const db=fs.readFileSync(path.join(root,'db-core.js'),'utf8');
const domain=fs.readFileSync(path.join(root,'project-vnext-3b.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'PXL-VNEXT-3B-MIGRATION.sql'),'utf8');

test('legacy Material Request and inventory issue interfaces remain present',()=>{
  assert.match(server,/\/api\/material-requests-form/);
  assert.match(server,/\/api\/crm\/material-requests/);
  assert.match(db,/async function getMRForms/);
  assert.match(db,/async function issueInventoryMaterialRequest/);
  assert.match(db,/inventory_issue_material_request/);
});

test('SO to WO, WO to MR Operasional, and ticket completion markers remain present',()=>{
  assert.match(server,/\/api\/crm\/sales-orders\/[^'"`]*work-order|\/work-order/);
  assert.match(server,/BUAT MR DARI SO|crm\/material-requests\/from-so/);
  assert.match(server,/complete|selesai|PENYELESAIAN/i);
});

test('Phase 3A 3A1 3A2 Project Detail surfaces remain present',()=>{
  for(const file of ['PXL-VNEXT-3A-MIGRATION.sql','PXL-VNEXT-3A2-MIGRATION.sql','public/pxl-vnext-3a-project-detail.js']) assert.equal(fs.existsSync(path.join(root,file)),true,file+' missing');
  assert.match(server,/\/api\/projects\/:id\/detail/);
  assert.match(server,/\/gantt-plan/);
  assert.match(server,/project-gantt-templates/);
  assert.match(server,/primary-work-order/);
  assert.match(server,/related-work-orders/);
});

test('Phase 3B implementation never writes to legacy material_request_forms',()=>{
  assert.doesNotMatch(domain,/material_request_forms/);
  assert.doesNotMatch(migration,/(insert\s+into|update|delete\s+from)\s+(public\.)?material_request_forms/i);
  const dbStart=db.indexOf('// PXL-VNEXT-3B — PROJECT MATERIAL REQUEST');
  const dbEnd=db.indexOf('// PXL-STG-0010',dbStart);
  assert.ok(dbStart>=0&&dbEnd>dbStart);
  assert.doesNotMatch(db.slice(dbStart,dbEnd),/material_request_forms/);
  const apiStart=server.indexOf('// PXL-VNEXT-3B — Project Material Request APIs');
  const apiEnd=server.indexOf("app.get('/api/project-reports'",apiStart);
  assert.ok(apiStart>=0&&apiEnd>apiStart);
  assert.doesNotMatch(server.slice(apiStart,apiEnd),/material_request_forms/);
});

test('Phase 3B migration is additive and safe for legacy schema',()=>{
  assert.doesNotMatch(migration,/\b(drop\s+table|truncate|delete\s+from\s+public\.material_request_forms|alter\s+table\s+public\.material_request_forms)\b/i);
  assert.match(migration,/alter table public\.projects add column if not exists project_number text/i);
  assert.match(migration,/notify pgrst,'reload schema'/i);
  assert.doesNotMatch(migration,/alter\s+table\s+public\.projects\s+drop|drop\s+column/i);
});
