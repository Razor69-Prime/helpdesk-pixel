const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');

test('BOQ selector shows material name only without embedding BOQ qty in option label',()=>{
  assert.doesNotMatch(ui,/item_name\|\|'-'\)} · BOQ \$\{h\(i\.boq_qty/);
});

test('BOQ editor fast-searches BOQ only and does not map Inventory during request entry',()=>{
  assert.doesNotMatch(ui,/Mapping Inventory/);
  assert.doesNotMatch(ui,/data-v3b-boq-inv/);
  assert.match(ui,/data-v3b-boq-search/);
  assert.match(ui,/Cari material BOQ Project/);
  assert.match(ui,/filterBoqForQuery/);
});

test('Inventory fast search is reserved for Take fulfillment',()=>{
  assert.match(ui,/data-v3b-take-inventory-search/);
  assert.match(ui,/selectTakeInventoryResult/);
  assert.match(ui,/inventory_item_id/);
});

test('submit validation does not require Inventory for BOQ items',()=>{
  assert.doesNotMatch(ui,/Mapping Inventory untuk BOQ/);
  assert.doesNotMatch(ui,/Pilih barang Inventory untuk BOQ baris/);
  assert.match(ui,/Pilih BOQ Project pada baris/);
});
