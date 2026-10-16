const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mr=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const photos=fs.readFileSync(path.join(root,'public/pxl-vnext-3d-project-photos.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');

test('Project photo upload temporarily uses plain resized image without watermark overlay',()=>{
  assert.match(photos,/renderPlainImage/);
  assert.doesNotMatch(photos,/const blockY=h-blockH/);
  assert.doesNotMatch(photos,/fillStyle='rgba\(0,0,0,\.38\)'/);
  assert.doesNotMatch(photos,/fillRect\(0,blockY,w,blockH\)/);
});

test('Project MR still supports explicit manual material server payload',()=>{
  assert.match(mr,/source_type:'manual',project_boq_item_id:null,item_name:name/);
  assert.match(mr,/item\.project_boq_item_id/);
  assert.doesNotMatch(mr,/inventory_extra/);
});

test('current browser assets remain cache-busted after PXL-URG-0113',()=>{
  assert.match(mr,/PXL-VNEXT-3D4/);
  assert.match(photos,/PXL-URG-0113/);
  assert.match(index,/pxl-vnext-3d-project-photos\.js\?v=PXL-VNEXT-3D2/);
  assert.match(sw,/PXL-URG-0113/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D4/);
  assert.match(sw,/pixelapps-inv1-v118/);
});
