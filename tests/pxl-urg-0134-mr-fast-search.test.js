'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {inject}=require('../pxl-urg-0121-pr-live-load-hook');

test('0134 restores original MR fast search once, after existing stable WO/PR/Price loaders',()=>{
  const source=read('public/index.html');
  const html=inject(source);
  assert.match(html,/\/pxl-stg-0004d\.js\?v=PXL-URG-0134/);
  assert.match(html,/\/pxl-urg-0040-master-pricelist-menu\.js\?v=PXL-URG-0132/);
  assert.match(html,/\/pxl-urg-0010-wo-autonumber\.js\?v=PXL-URG-0133/);
  assert.match(html,/\/pxl-urg-0121-pr-live-load\.js/);
  assert.equal((html.match(/\/pxl-stg-0004d\.js/g)||[]).length,1);
  assert.equal(inject(html),html,'duplicate reload safe');
  const existing='<html><body><script src="/pxl-stg-0004d.js?v=existing"></script></body></html>';
  assert.equal((inject(existing).match(/\/pxl-stg-0004d\.js/g)||[]).length,1);
  const native=read('public/index.html');
  for(const identifier of ['mr-sku-input','mr-search-results','renderMRSearchSuggestions(this.value)','addMRItemBySku()'])assert.ok(native.includes(identifier));
});

test('0134 restored module searches Inventory and Master Pricelist live without changing backend or inventory',async()=>{
  const requests=[];
  const data=[
    {id:'inv-1',name:'Camera IPC 4MP',sku:'IPC-4MP',stock:12,unit:'pcs',inventory_available:true},
    {id:'price:cat-1',name:'NVR 8 Channel Pro',source_type:'pricelist',source_status:'pricelist_only',source_key:'cat-1',hpp:500000,inventory_available:false},
    {id:'inv-2',name:'Kabel UTP CAT6',sku:'UTP-CAT6',stock:48,unit:'meter',inventory_available:true}
  ];
  const status={textContent:''};
  let handlers=[];
  const box={style:{display:'none'},innerHTML:'',querySelectorAll(selector){
    assert.equal(selector,'[data-mr-catalog-id]');
    return handlers;
  }};
  const input={value:'',focus(){this.focused=true}};
  const win={
    addMRItemRow(item){return item;},
    getMRItems(){return []}
  };
  const doc={
    getElementById(id){return {'mr-inventory-status':status,'mr-search-results':box,'mr-sku-input':input}[id]||null;},
    addEventListener(){}
  };
  const api=async(method,url)=>{requests.push([method,url]);return {items:data}};
  vm.runInNewContext(read('public/pxl-stg-0004d.js'),{window:win,document:doc,api,console});
  await win.loadMRInventoryItems();
  assert.deepEqual(requests,[['GET','/material-catalog']]);
  assert.equal(win.mrInventoryItems.length,3);
  assert.ok(win.findMRInventoryMatches('4mp').some(item=>item.id==='inv-1'));
  assert.ok(win.findMRInventoryMatches('NVR').some(item=>item.id==='price:cat-1'));
  assert.ok(win.findMRInventoryMatches('UTP-CAT6').some(item=>item.id==='inv-2'));
  handlers=[{dataset:{mrCatalogId:'price:cat-1'},onmousedown:null}];
  win.renderMRSearchSuggestions('NVR');
  assert.equal(box.style.display,'block');
  assert.match(box.innerHTML,/Master Pricelist/);
  assert.match(box.innerHTML,/NVR 8 Channel Pro/);
  assert.equal(typeof handlers[0].onmousedown,'function');
  let selected;
  win.selectMRSearchItem=id=>{selected=id};
  handlers[0].onmousedown({preventDefault(){}});
  assert.equal(selected,'price:cat-1');
  win.renderMRSearchSuggestions('');
  assert.equal(box.style.display,'none');
});

test('0134 only changes loader; restores existing MR script without database migration',()=>{
  const staged=read('pxl-urg-0121-pr-live-load-hook.js');
  assert.match(staged,/pxl-stg-0004d\.js/);
  assert.match(staged,/patchWoSubmitNumber/);
  assert.match(staged,/patchWoOptionalTechnician/);
  const original=read('public/pxl-stg-0004d.js');
  assert.match(original,/PXL-STG-0004D/);
  assert.match(original,/api\('GET','\/material-catalog'\)/);
  assert.match(original,/window\.renderMRSearchSuggestions/);
  assert.match(original,/window\.selectMRSearchItem/);
});
