const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const {summarizeProjectMaterialLedger}=require('../project-vnext-3c');

function route(method,url){
  const start=server.indexOf(`app.${method}('${url}'`); assert.notEqual(start,-1,`${method} ${url} missing`);
  const next=server.indexOf('\napp.',start+10); return server.slice(start,next<0?server.length:next);
}

test('GET material overrides uses Project Report read access and exact BOQ item filter',()=>{
  const r=route('get','/api/project-report-items/:id/material-overrides');
  assert.match(r,/requireProjectReportRead/);
  assert.match(r,/db\.getProjectReportItems\(/);
  assert.match(r,/db\.getProjectMaterialOverrides\(\{itemId:item\.id\}\)/);
  assert.match(r,/404/);
});

test('POST material override is Superadmin-only and validates current material BOQ identity',()=>{
  const r=route('post','/api/project-report-items/:id/material-overrides');
  assert.match(r,/requireRole\('superadmin'\)/);
  assert.doesNotMatch(r,/project_mr_approve|project_boq_manage|custom_menus/);
  assert.match(r,/normalizeProjectMaterialOverrideInput\(req\.body\|\|\{\}\)/);
  assert.match(r,/category[^\n]*material/i);
  assert.match(r,/Project tidak ditemukan|project[^\n]*tidak ditemukan/i);
  assert.match(r,/Detail BOQ tidak ditemukan/);
});

test('POST override snapshots server-side project, BOQ, Primary WO, actor, reason and timestamp',()=>{
  const r=route('post','/api/project-report-items/:id/material-overrides');
  assert.match(r,/db\.getProjectPrimaryWorkOrder\(item\.project_id\)/);
  assert.match(r,/project_id:item\.project_id/);
  assert.match(r,/project_boq_item_id:item\.id/);
  assert.match(r,/primary_work_order_ticket_id:primary\?\.ticket_id\|\|null/);
  assert.match(r,/item_name_snapshot:item\.item_name/);
  assert.match(r,/qty:input\.qty/);
  assert.match(r,/reason:input\.reason/);
  assert.match(r,/created_by_user_id:req\.session\.user\.id/);
  assert.match(r,/created_by:req\.session\.user\.name/);
  assert.match(r,/created_at:new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(r,/project_id:req\.body|project_boq_item_id:req\.body|created_by:req\.body/);
});

test('POST override logs context and returns refreshed Project Report ledger item',()=>{
  const r=route('post','/api/project-report-items/:id/material-overrides');
  assert.match(r,/logActivity\(/);
  assert.match(r,/OVERRIDE MATERIAL PROJECT/);
  assert.match(r,/item\.item_name/);
  assert.match(r,/input\.qty/);
  assert.match(r,/buildProjectReportRows\(\)/);
  assert.match(r,/mr_approved_qty|usage_limit|available_for_use/);
});

test('multiple active overrides sum and there is no delete override endpoint',()=>{
  const result=summarizeProjectMaterialLedger({
    boqItemId:'boq-1',
    materialRequests:[{status:'approved',items:[{project_boq_item_id:'boq-1',qty_requested:5}]}],
    overrides:[
      {project_boq_item_id:'boq-1',qty:2,reversed_at:null},
      {project_boq_item_id:'boq-1',qty:3,reversed_at:null}
    ],
    totalDone:4
  });
  assert.equal(result.override_qty,5);
  assert.equal(result.usage_limit,10);
  assert.equal(result.available_for_use,6);
  assert.equal(server.includes("app.delete('/api/project-report-items/:id/material-overrides"),false);
});
