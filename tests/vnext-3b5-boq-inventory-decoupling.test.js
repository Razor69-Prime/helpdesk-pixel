const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const sql=fs.readFileSync(path.join(root,'PXL-VNEXT-3B-MIGRATION.sql'),'utf8');
function route(method,url){const start=server.indexOf(`app.${method}('${url}'`);assert.notEqual(start,-1);const next=server.indexOf('\napp.',start+10);return server.slice(start,next<0?server.length:next)}
function functionBlock(name){const start=sql.search(new RegExp(`create or replace function public\\.${name}`,'i'));assert.notEqual(start,-1);const next=sql.indexOf('create or replace function public.',start+30);return sql.slice(start,next<0?sql.length:next)}

test('BOQ MR can be submitted without inventory_item_id',()=>{
  const submit=route('post','/api/project-material-requests/:id/submit');
  assert.doesNotMatch(submit,/some\(item=>!item\.inventory_item_id\)/);
  assert.doesNotMatch(submit,/wajib terhubung ke Inventory/);
});

test('draft BOQ editor fast-searches BOQ only and does not ask for Inventory',()=>{
  assert.match(ui,/data-v3b-boq-search/);
  assert.match(ui,/Cari material BOQ Project/);
  assert.doesNotMatch(ui,/Cari BOQ \/ barang Inventory/);
  assert.doesNotMatch(ui,/sebelum diajukan/);
});

test('approved BOQ item chooses Inventory only at Take time',()=>{
  assert.match(ui,/data-v3b-take-inventory-search/);
  assert.match(ui,/Pilih Inventory saat Take/);
  assert.match(ui,/inventory_item_id/);
  assert.match(ui,/movement_type:type,items:\[\{item_id:itemId,qty,inventory_item_id/);
});

test('movement API accepts optional inventory_item_id only as movement input',()=>{
  const movement=route('post','/api/project-material-requests/:id/movements');
  assert.match(movement,/inventory_item_id/);
  assert.match(movement,/return \{item_id:x\.item_id,qty,inventory_item_id/);
});

test('first Take can bind an unlinked BOQ item to Inventory and later Take cannot switch it',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/v_requested_inventory_id/);
  assert.match(block,/inventory_item_id is null[\s\S]*v_requested_inventory_id is null[\s\S]*Pilih Inventory/i);
  assert.match(block,/update public\.project_material_request_items set inventory_item_id=v_requested_inventory_id/i);
  assert.match(block,/v_item\.inventory_item_id<>v_requested_inventory_id|v_item\.inventory_item_id != v_requested_inventory_id/i);
  assert.match(block,/Inventory.*tidak dapat diganti|tidak boleh mengganti Inventory/i);
});

test('3B5 ships a production delta migration for Take-time Inventory binding',()=>{
  const delta=fs.readFileSync(path.join(root,'PXL-VNEXT-3B5-MIGRATION.sql'),'utf8');
  assert.match(delta,/create or replace function public\.pxl_vnext_3b_apply_project_mr_movement/i);
  assert.match(delta,/v_requested_inventory_id/);
  assert.doesNotMatch(delta,/drop table|truncate/i);
  assert.match(delta,/notify pgrst,'reload schema'/i);
});
