const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const modulePath=path.join(root,'public/pxl-vnext-3b-project-mr.js');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const detail=fs.readFileSync(path.join(root,'public/pxl-vnext-3a-project-detail.js'),'utf8');
const report=fs.readFileSync(path.join(root,'public/pxl-stg-0016-project-report.js'),'utf8');
function src(){assert.equal(fs.existsSync(modulePath),true,'Project MR UI module must exist');return fs.readFileSync(modulePath,'utf8');}

test('Project MR module exposes open/refresh and dedicated Project MR APIs',()=>{
  const s=src();
  assert.match(s,/window\.pxlProjectMr/);
  assert.match(s,/open:open/);assert.match(s,/refresh:refresh/);
  assert.match(s,/\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/material-requests/);
  assert.match(s,/material-request-catalog/);
  assert.match(s,/\/project-material-requests\/\$\{encodeURIComponent/);
});

test('project identity and MR number come from API and browser never invents MRP sequence',()=>{
  const s=src();
  assert.match(s,/project_number/);assert.match(s,/nama_project/);assert.match(s,/mr_number/);
  assert.doesNotMatch(s,/MRP-PRJ-[^'"`]*padStart|nextMr|mrSequence/i);
});

test('Draft/Rejected editor is BOQ first and extra Inventory requires reason and positive qty',()=>{
  const s=src();
  assert.match(s,/BOQ Project/);
  assert.match(s,/Tambah Material di Luar BOQ/);
  assert.match(s,/inventory_extra/);
  assert.match(s,/additional_reason/);
  assert.match(s,/Alasan/);
  assert.match(s,/qty_requested/);
  assert.match(s,/Number\.isFinite\(qty\).*qty<=0/s);
});

test('submitted approved issued final are read-only while rejected can edit and resubmit',()=>{
  const s=src();
  assert.match(s,/\['draft','rejected'\]\.includes/);
  for(const status of ['submitted','approved','issued','final'])assert.match(s,new RegExp(status));
  assert.match(s,/reject_reason/);
  assert.match(s,/submit/);
  assert.match(s,/Simpan.*Ajukan|Ajukan.*MR Project/s);
});

test('Project Detail and Project Report integrate Project MR without widening Project Tracker CRUD',()=>{
  assert.match(detail,/data-v3a-tab="material-request"/);
  assert.match(detail,/window\.pxlProjectMr\.open\(state\.projectId/);
  assert.match(report,/openProjectMaterialRequest/);
  assert.match(report,/window\.pxlProjectMr\.open\(projectId/);
  assert.match(report,/Material Request Project/);
  assert.doesNotMatch(detail,/>Documents</);assert.doesNotMatch(detail,/>SPJ</);
});

test('Phase 3B script is explicitly included after Project Detail',()=>{
  assert.match(index,/pxl-vnext-3a-project-detail\.js[^<]*<\/script><script src="\/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3B"/);
});

test('BOQ item supports explicit Inventory mapping when exact auto-match is unavailable',()=>{
  const s=src();
  assert.match(s,/data-v3b-boq-inv/);
  assert.match(s,/Mapping Inventory|Inventory Mapping/);
  assert.match(s,/inventory_item_id/);
});
