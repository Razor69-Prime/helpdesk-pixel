const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mr=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');

test('Project MR uses one material autocomplete with manual fallback',()=>{
  assert.match(mr,/function materialSearchBox\(item,index\)/);
  assert.match(mr,/Ketik untuk mencari BOQ Project, atau isi nama material manual/);
  assert.match(mr,/item\.source_type='manual'/);
  assert.match(mr,/item\.item_name=input\.value/);
  assert.match(mr,/item\.source_type='boq'/);
  assert.match(mr,/item\.project_boq_item_id=row\.id/);
});

test('Project MR exposes one Add Item action and removes separate manual BOQ actions',()=>{
  assert.match(mr,/id="pxl-v3b-add-item"[^>]*>＋ Tambah Item</);
  assert.doesNotMatch(mr,/id="pxl-v3b-add-manual"/);
  assert.doesNotMatch(mr,/id="pxl-v3b-add-boq"/);
  assert.match(mr,/\$\('#pxl-v3b-add-item'\)\.onclick/);
});

test('manual free text validates without BOQ id while selected BOQ preserves exact identity',()=>{
  assert.match(mr,/if\(item\.project_boq_item_id\)/);
  assert.match(mr,/source_type:'boq',project_boq_item_id:item\.project_boq_item_id/);
  assert.match(mr,/const name=String\(item\.item_name\|\|item\.boq_search\|\|' '\)/);
  assert.match(mr,/source_type:'manual',project_boq_item_id:null,item_name:name/);
});

test('3D4 MR asset is cache-busted',()=>{
  assert.match(mr,/PXL-VNEXT-3D4/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D4/);
  assert.match(sw,/pixelapps-inv1-v122/);
});
