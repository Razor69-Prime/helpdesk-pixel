const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');

test('BOQ selector shows material name only without embedding BOQ qty in option label',()=>{
  assert.doesNotMatch(ui,/item_name\|\|'-'\)} · BOQ \$\{h\(i\.boq_qty/);
});

test('BOQ editor uses fast Inventory search instead of Mapping Inventory select',()=>{
  assert.doesNotMatch(ui,/Mapping Inventory/);
  assert.doesNotMatch(ui,/data-v3b-boq-inv/);
  assert.match(ui,/data-v3b-inv-search/);
  assert.match(ui,/Cari barang Inventory/);
  assert.match(ui,/filterInventoryForQuery/);
});

test('Inventory fast search seeds query from selected BOQ material name and stores selected inventory_item_id',()=>{
  assert.match(ui,/inventory_search/);
  assert.match(ui,/row\?\.item_name/);
  assert.match(ui,/inventory_item_id/);
});

test('submit validation asks user to choose Inventory item, not mapping terminology',()=>{
  assert.doesNotMatch(ui,/Mapping Inventory untuk BOQ/);
  assert.match(ui,/Pilih barang Inventory untuk BOQ baris/);
});
