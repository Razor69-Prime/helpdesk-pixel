const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');

test('BOQ selector shows material name only without embedding BOQ qty in option label',()=>{
  assert.doesNotMatch(ui,/item_name\|\|'-'\)} · BOQ \$\{h\(i\.boq_qty/);
});

test('BOQ editor keeps fast search without Mapping Inventory and uses the unified material control',()=>{
  assert.doesNotMatch(ui,/Mapping Inventory/);
  assert.doesNotMatch(ui,/data-v3b-boq-inv/);
  assert.match(ui,/data-v3b-material-search/);
  assert.match(ui,/Cari BOQ \/ barang Inventory/);
  assert.match(ui,/filterInventoryForQuery/);
});

test('unified fast search retains BOQ and Inventory identifiers in one control',()=>{
  assert.match(ui,/material_search/);
  assert.match(ui,/selectBoqSearchResult/);
  assert.match(ui,/selectInventorySearchResult/);
  assert.match(ui,/inventory_item_id/);
});

test('submit validation asks user to choose Inventory item, not mapping terminology',()=>{
  assert.doesNotMatch(ui,/Mapping Inventory untuk BOQ/);
  assert.match(ui,/Pilih barang Inventory untuk BOQ baris/);
});
