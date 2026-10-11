const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');

test('Project MR uses one unified fast-search control instead of BOQ select plus separate inventory search',()=>{
  assert.match(ui,/data-v3b-material-search/);
  assert.match(ui,/Cari BOQ \/ barang Inventory/i);
  assert.doesNotMatch(ui,/data-v3b-boq=/);
  assert.doesNotMatch(ui,/data-v3b-inv-search/);
  assert.doesNotMatch(ui,/Mapping Inventory/);
});

test('unified search first chooses BOQ then chooses Inventory in the same control',()=>{
  assert.match(ui,/filterBoqForQuery/);
  assert.match(ui,/filterInventoryForQuery/);
  assert.match(ui,/selectBoqSearchResult/);
  assert.match(ui,/selectInventorySearchResult/);
  assert.match(ui,/project_boq_item_id/);
  assert.match(ui,/inventory_item_id/);
});
