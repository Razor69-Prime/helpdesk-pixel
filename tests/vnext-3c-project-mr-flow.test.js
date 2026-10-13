const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'PXL-VNEXT-3C-MIGRATION.sql'),'utf8');
const {normalizeProjectMrItems}=require('../project-vnext-3b');

function route(method,url){
  const start=server.indexOf(`app.${method}('${url}'`); assert.notEqual(start,-1,`${method} ${url} missing`);
  const next=server.indexOf('\napp.',start+10); return server.slice(start,next<0?server.length:next);
}

test('current MR normalizer accepts BOQ and manual material while rejecting inventory_extra',()=>{
  assert.deepEqual(normalizeProjectMrItems([{source_type:'boq',project_boq_item_id:'boq-1',qty_requested:'2',item_name:'Kamera',unit:'pcs'}],{requireItems:true}),[
    {source_type:'boq',project_boq_item_id:'boq-1',item_name:'Kamera',unit:'pcs',qty_requested:2,sort_order:0}
  ]);
  assert.deepEqual(normalizeProjectMrItems([{source_type:'manual',item_name:'Material Manual',unit:'pcs',qty_requested:2}]),[{source_type:'manual',project_boq_item_id:null,item_name:'Material Manual',unit:'pcs',qty_requested:2,sort_order:0}]);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'inventory_extra',inventory_item_id:'inv-1',qty_requested:1,additional_reason:'tambahan'}]),/BOQ|Manual|sumber/i);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'boq',qty_requested:1}]),/BOQ/i);
});

test('new Project MR requires a Primary WO before createProjectMaterialRequest',()=>{
  const r=route('post','/api/projects/:projectId/material-requests');
  const primaryAt=r.indexOf('db.getProjectPrimaryWorkOrder');
  const createAt=r.indexOf('db.createProjectMaterialRequest');
  assert.ok(primaryAt>=0,'Primary WO lookup missing');
  assert.ok(createAt>primaryAt,'MR must not be created before Primary WO check');
  assert.match(r,/primary[^\n]*ticket_id|ticket_id[^\n]*primary/i);
  assert.match(r,/status\(400\)[\s\S]*Primary WO/i);
});

test('Project MR catalog reads only Project BOQ material and no Inventory, Related WO, or Operational source',()=>{
  const r=route('get','/api/projects/:projectId/material-request-catalog');
  assert.match(r,/db\.getProjectReportItems\(req\.params\.projectId\)/);
  assert.match(r,/category\|\|''\)\.toLowerCase\(\)===['"]material['"]/);
  assert.doesNotMatch(r,/getInventoryItems|getProjectRelatedWorkOrders|material_request_forms|getMaterialRequests\(/);
  assert.doesNotMatch(r,/inventory_items/);
});

test('replace and submit validate BOQ IDs against the owning project material rows',()=>{
  assert.match(server,/async function validateProjectMrBoqItems\(projectId,items\)/);
  const put=route('put','/api/project-material-requests/:id/items');
  const submit=route('post','/api/project-material-requests/:id/submit');
  assert.match(put,/validateProjectMrBoqItems\(mr\.project_id,items\)/);
  assert.match(submit,/validateProjectMrBoqItems\(mr\.project_id,items\)/);
  const helperStart=server.indexOf('async function validateProjectMrBoqItems(projectId,items)');
  const helperEnd=server.indexOf('\nfunction notifyProjectMrRoles',helperStart);
  const helper=server.slice(helperStart,helperEnd);
  assert.match(helper,/db\.getProjectReportItems\(projectId\)/);
  assert.match(helper,/category/);
  assert.match(helper,/project_boq_item_id/);
  assert.doesNotMatch(helper,/item_name[^\n]*===/);
});

test('3C SQL replace-items RPC enforces BOQ-only writes while keeping historical schema intact',()=>{
  assert.match(sql,/create or replace function public\.pxl_vnext_3b_replace_project_mr_items/i);
  const start=sql.search(/create or replace function public\.pxl_vnext_3b_replace_project_mr_items/i);
  const end=sql.indexOf('end; $$;',start);
  const fn=sql.slice(start,end+8);
  assert.match(fn,/v_source\s*<>\s*'boq'|v_source\s*!=\s*'boq'/i);
  assert.match(fn,/pri\.project_id=v_mr\.project_id/i);
  assert.match(fn,/pri\.category='material'/i);
  assert.doesNotMatch(fn,/elsif\s+v_source='inventory_extra'/i);
});

test('3B6 Project MR approval policy and immutable approval payload remain intact',()=>{
  const approveGuard=server.slice(server.indexOf('function requireProjectMrApproval'),server.indexOf('function rejectProjectMrMutationPayload'));
  assert.match(approveGuard,/superadmin/);
  assert.match(approveGuard,/manager/);
  assert.match(approveGuard,/admin/);
  assert.match(approveGuard,/project_mr_approve/);
  const rejectGuard=server.slice(server.indexOf('function rejectProjectMrMutationPayload'),server.indexOf('async function requireProjectMrOwner'));
  assert.match(rejectGuard,/qty_requested/);
  assert.match(rejectGuard,/project_boq_item_id/);
});
