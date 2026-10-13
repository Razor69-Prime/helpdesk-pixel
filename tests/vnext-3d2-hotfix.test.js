const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const mr=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const photos=fs.readFileSync(path.join(root,'public/pxl-vnext-3d-project-photos.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');

function mrInternals(){
  const hook="window.pxlProjectMr={revision:REV,open:open,refresh:refresh,close:close};";
  assert.ok(mr.includes(hook),'MR test hook anchor missing');
  const source=mr.replace(hook,"window.__pxlMrTest={state,isEmptyBoqPlaceholder,validatedEditorItems};");
  const sandbox={window:{},document:{querySelector:()=>null},localStorage:{getItem:()=>''},console,setTimeout:()=>{}};
  vm.runInNewContext(source,sandbox);
  return sandbox.window.__pxlMrTest;
}

test('manual MR removes incomplete BOQ rows before adding manual material',()=>{
  assert.match(mr,/function isIncompleteBoqRow\(/);
  assert.match(mr,/state\.editorItems=state\.editorItems\.filter\(item=>!isIncompleteBoqRow\(item\)\)/);
  assert.match(mr,/source_type:'manual'/);
});

test('manual MR save ignores an empty BOQ placeholder but keeps the manual item',()=>{
  const api=mrInternals();
  api.state.editorItems=[
    {source_type:'boq',project_boq_item_id:null,boq_search:'',item_name:null,unit:null,qty_requested:1},
    {source_type:'manual',project_boq_item_id:null,item_name:'Kabel Tambahan',unit:'meter',qty_requested:12}
  ];
  const result=JSON.parse(JSON.stringify(api.validatedEditorItems()));
  assert.deepEqual(result,[{source_type:'manual',project_boq_item_id:null,item_name:'Kabel Tambahan',unit:'meter',qty_requested:12,sort_order:0}]);
});

test('partially typed BOQ without a selected BOQ id is still rejected',()=>{
  const api=mrInternals();
  api.state.editorItems=[
    {source_type:'boq',project_boq_item_id:null,boq_search:'Kabel',item_name:null,unit:null,qty_requested:1},
    {source_type:'manual',project_boq_item_id:null,item_name:'Item Manual',unit:'pcs',qty_requested:1}
  ];
  assert.throws(()=>api.validatedEditorItems(),/Pilih BOQ Project pada baris 1/);
});

test('MR validation ignores only truly empty BOQ placeholders before validating real rows',()=>{
  assert.match(mr,/state\.editorItems\.filter\(item=>!isEmptyBoqPlaceholder\(item\)\)/);
  assert.match(mr,/if\(!rows\.length\)throw new Error\('Minimal satu item MR Project wajib diisi\.'/);
  assert.match(mr,/Pilih BOQ Project pada baris/);
});

test('Project photo watermark renders as a lighter footer overlay',()=>{
  assert.match(photos,/const blockY=h-blockH/);
  assert.match(photos,/fillStyle='rgba\(0,0,0,\.38\)'/);
  assert.match(photos,/fillRect\(0,blockY,w,blockH\)/);
  assert.match(photos,/drawImage\(logo,pad,blockY\+pad,lw,logoH\)/);
  assert.match(photos,/let y=blockY\+pad/);
});

test('3D2 browser assets are cache-busted',()=>{
  assert.match(mr,/PXL-VNEXT-3D3/);
  assert.match(photos,/PXL-VNEXT-3D2/);
  assert.match(index,/pxl-vnext-3d-project-photos\.js\?v=PXL-VNEXT-3D2/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D3/);
  assert.match(sw,/pixelapps-inv1-v117/);
});
