const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const dbCore=fs.readFileSync(path.join(root,'db-core.js'),'utf8');
const {summarizeProjectMaterialLedger}=require('../project-vnext-3c');

function block(src,startText,endText){
  const start=src.indexOf(startText); assert.notEqual(start,-1,`missing ${startText}`);
  const end=src.indexOf(endText,start+startText.length);
  return src.slice(start,end<0?src.length:end);
}

test('db-core exposes batched Project MR item and override adapters without delete adapter',()=>{
  const mr=block(dbCore,'async function getProjectMaterialRequests','// PXL-STG-0010');
  assert.match(mr,/async function getProjectMaterialRequestItemsByRequestIds\(requestIds=\[\]\)/);
  assert.match(mr,/const BATCH_SIZE\s*=\s*50/);
  assert.match(mr,/project_material_request_id=in\.\(\$\{inFilter\}\)/);
  assert.match(mr,/async function getProjectMaterialOverrides\(\{projectId=null,itemId=null\}=\{\}\)/);
  assert.match(mr,/project_material_usage_overrides/);
  assert.match(mr,/async function insertProjectMaterialOverride\(data\)/);
  assert.doesNotMatch(mr,/deleteProjectMaterialOverride/);
  const exports=block(dbCore,'module.exports = {','};');
  for(const name of ['getProjectMaterialRequestItemsByRequestIds','getProjectMaterialOverrides','insertProjectMaterialOverride']) assert.match(exports,new RegExp(`\\b${name}\\b`));
});

test('buildProjectReportRows bulk-loads project MR data and enriches material rows by BOQ id',()=>{
  assert.match(server,/require\('\.\/project-vnext-3c'\)/);
  const fn=block(server,'async function buildProjectReportRows(){','// PXL-VNEXT-3A');
  assert.match(fn,/db\.getProjectMaterialRequests\(\)/);
  assert.match(fn,/db\.getProjectMaterialRequestItemsByRequestIds\(/);
  assert.match(fn,/db\.getProjectMaterialOverrides\(/);
  assert.match(fn,/summarizeProjectMaterialLedger\(\{[\s\S]*boqItemId:i\.id[\s\S]*totalDone:done/);
  assert.match(fn,/mr_approved_qty/);
  assert.match(fn,/override_qty/);
  assert.match(fn,/usage_limit/);
  assert.match(fn,/available_for_use/);
  assert.doesNotMatch(fn,/material_request_forms|crm_material_requests/i);
  assert.doesNotMatch(fn,/item_name_snapshot\s*===|item_name\s*===/);
});

test('ledger identity does not cross-count identically named BOQ rows',()=>{
  const materialRequests=[{status:'approved',items:[
    {project_boq_item_id:'boq-a',item_name_snapshot:'Kamera Sama',qty_requested:3},
    {project_boq_item_id:'boq-b',item_name_snapshot:'Kamera Sama',qty_requested:9}
  ]}];
  const a=summarizeProjectMaterialLedger({boqItemId:'boq-a',materialRequests,overrides:[],totalDone:1});
  const b=summarizeProjectMaterialLedger({boqItemId:'boq-b',materialRequests,overrides:[],totalDone:2});
  assert.equal(a.mr_approved_qty,3);
  assert.equal(b.mr_approved_qty,9);
  assert.equal(a.available_for_use,2);
  assert.equal(b.available_for_use,7);
});

test('Project Report category calculations remain based on BOQ achievements, not MR ledger',()=>{
  const fn=block(server,'async function buildProjectReportRows(){','// PXL-VNEXT-3A');
  assert.match(fn,/const calcCategory=cat=>/);
  assert.match(fn,/const boq=list\.reduce\(\(n,i\)=>n\+Number\(i\.boq_qty\|\|0\),0\)/);
  assert.match(fn,/const done=list\.reduce\(\(n,i\)=>n\+Number\(i\.total_done\|\|0\),0\)/);
  assert.match(fn,/remain:Math\.max\(boq-done,0\)/);
});
