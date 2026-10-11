const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');

test('Project MR uses one BOQ fast-search control during Draft',()=>{
  assert.match(ui,/data-v3b-boq-search/);
  assert.match(ui,/Cari material BOQ Project/i);
  assert.doesNotMatch(ui,/data-v3b-material-search/);
  assert.doesNotMatch(ui,/Mapping Inventory/);
});

test('Inventory search is moved to Take lifecycle and remains separate from BOQ request entry',()=>{
  assert.match(ui,/filterBoqForQuery/);
  assert.match(ui,/filterInventoryForQuery/);
  assert.match(ui,/selectBoqSearchResult/);
  assert.match(ui,/selectTakeInventoryResult/);
  assert.match(ui,/data-v3b-take-inventory-search/);
});
