const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mr=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');

test('unified material picker removes the separate manual mode that caused incomplete BOQ blockers',()=>{
  assert.match(mr,/data-v3b-material-search/);
  assert.match(mr,/item\.source_type='manual'/);
  assert.match(mr,/item\.project_boq_item_id=null/);
  assert.doesNotMatch(mr,/pxl-v3b-add-manual|pxl-v3b-add-boq/);
});

test('3D4 assets supersede the 3D3 manual-mode hotfix',()=>{
  assert.match(mr,/PXL-VNEXT-3D4/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D4/);
  assert.match(sw,/const CACHE='pixelapps-inv1-v119'/);
});
