'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const photo=fs.readFileSync(path.join(root,'public/pxl-vnext-3d-project-photos.js'),'utf8');
const mrUi=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const {normalizeProjectMrItems}=require('../project-vnext-3b');

function block(src,startText,endText){
  const start=src.indexOf(startText);assert.notEqual(start,-1,`missing ${startText}`);
  const end=src.indexOf(endText,start+startText.length);
  return src.slice(start,end<0?src.length:end);
}

test('Project photo modal sits above Project Report modal',()=>{
  const match=photo.match(/\.p3d-modal\{[^}]*z-index:(\d+)/);
  assert.ok(match,'missing p3d modal z-index');
  assert.ok(Number(match[1])>10020,`photo modal z-index ${match[1]} must be above Project Report 10020`);
});

test('Project MR normalizer accepts explicit manual material without BOQ identity',()=>{
  const rows=normalizeProjectMrItems([{source_type:'manual',item_name:'Kabel Dropcore 2 Core',unit:'meter',qty_requested:100}],{requireItems:true});
  assert.deepEqual(rows,[{source_type:'manual',project_boq_item_id:null,item_name:'Kabel Dropcore 2 Core',unit:'meter',qty_requested:100,sort_order:0}]);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'manual',item_name:'',qty_requested:1}],{requireItems:true}),/nama material manual/i);
});

test('Project MR UI keeps manual material support through the unified picker and draft reload',()=>{
  assert.match(mrUi,/data-v3b-material-search/);
  assert.match(mrUi,/source_type:'manual'/);
  assert.match(mrUi,/data-v3b-unit/);
  assert.match(mrUi,/nama material manual|material manual/i);
  assert.doesNotMatch(mrUi,/Tambah Item Manual|data-v3b-manual-name/);
  const load=block(mrUi,'async function loadDetail(requestId){','async function refresh(){');
  assert.match(load,/source_type:i\.source_type==='boq'\?'boq':'manual'/);
  assert.match(load,/boq_search:i\.item_name_snapshot/);
});

test('Project MR server validation allows manual rows while BOQ rows remain exact-project validated',()=>{
  const validation=block(server,'async function validateProjectMrBoqItems(projectId,items){','async function requireProjectMrOwner');
  assert.match(validation,/source=String\(item\?\.source_type[\s\S]*if\(source==='manual'\)/);
  assert.match(validation,/item_name/);
  assert.match(validation,/validIds\.has/);
});

test('3D1 migration expands source_type and replace RPC for manual material without changing BOQ ledger identity',()=>{
  const file=path.join(root,'PXL-VNEXT-3D1-MIGRATION.sql');
  assert.ok(fs.existsSync(file),'missing PXL-VNEXT-3D1-MIGRATION.sql');
  const sql=fs.readFileSync(file,'utf8');
  assert.match(sql,/source_type\s+in\s*\([^)]*'boq'[^)]*'manual'/i);
  assert.match(sql,/v_source\s*=\s*'manual'/i);
  assert.match(sql,/item_name/i);
  assert.match(sql,/project_boq_item_id/i);
  assert.doesNotMatch(sql,/update\s+public\.project_report_items/i);
});
