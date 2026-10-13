const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mr=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');

test('manual MR discards every unselected BOQ row before adding the manual row',()=>{
  assert.match(mr,/function isIncompleteBoqRow\(item\)/);
  assert.match(mr,/source_type\|\|''\)\.toLowerCase\(\)==='boq'/);
  assert.match(mr,/!item\?\.project_boq_item_id/);
  assert.match(mr,/state\.editorItems=state\.editorItems\.filter\(item=>!isIncompleteBoqRow\(item\)\)/);
  assert.match(mr,/state\.editorItems\.push\(manual\)/);
});

test('3D3 assets are cache-busted after the manual MR fix',()=>{
  assert.match(mr,/PXL-VNEXT-3D3/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D3/);
  assert.match(sw,/const CACHE='pixelapps-inv1-v117'/);
});
