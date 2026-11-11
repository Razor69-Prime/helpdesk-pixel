'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/sales-order.html');
const sites=read('public/pxl-prod-0022ab-sales-order-sites.js');
const manual=read('public/pxl-urg-0021-sales-order-manual-material-maps.js');
const loader=read('pxl-stg-0004f.js');
const sourceBetween=(src,begin,end)=>{
  const start=src.indexOf(begin),stop=src.indexOf(end,start+begin.length);
  assert.ok(start>=0&&stop>start,'Function boundaries present: '+begin);
  return src.slice(start,stop).trim();
};
const parseFunction=(code,context)=>vm.runInNewContext('('+code+')',context);

test('0136 restores manual-source UI after all SO wrappers on the actual served /sales-order.html',()=>{
  assert.match(loader,/forceSalesOrderScriptOrder\(html\)/);
  assert.match(loader,/const ordered=\[[^\n]*pxl-urg-0021-sales-order-manual-material-maps\.js\?v=PXL-URG-0136/);
  assert.ok(loader.indexOf('pxl-urg-0030-pricing-calculator.js?v=PXL-URG-0030')<loader.indexOf('pxl-urg-0021-sales-order-manual-material-maps.js?v=PXL-URG-0136'));
  assert.match(manual,/option value="manual">Input Manual/);
  assert.match(manual,/row\.dataset\.manualMaterial=manual\?'1':'0'/);
  assert.match(manual,/data\?\.manual_material===true/);
});

function fakeRow(data={}){
  const inputs={
    '.item-search':{value:data.name||'Manual CCTV',addEventListener(){},focus(){}},
    '.qty':{value:String(data.qty||2),addEventListener(){}},
    '.unit':{value:data.unit||'pcs',addEventListener(){}},
    '.price':{value:String(data.unit_price||125000),addEventListener(){}},
    '.line-total':{value:'',addEventListener(){}},
    '.selected-item':{textContent:'',style:{}},
    '.item-results':{classList:{add(){},remove(){}}},
    '.remove':{addEventListener(){}},
    '.pxl-material-source':{value:data.mode||'manual'},
  };
  const row={dataset:{manualMaterial:data.manualMaterial||'1',inventoryId:data.inventoryId||'',manualId:data.manualId||'',sourceType:data.sourceType||'manual',sourceKey:data.sourceKey||'',sku:data.sku||'',catalogId:data.catalogId||'',packageId:data.packageId||'',ppnApplied:data.ppnApplied||'0',ppnRate:data.ppnRate||''},
    querySelector:s=>inputs[s]||null,querySelectorAll:s=>s==='.qty,.price'?[inputs['.qty'],inputs['.price']]:[]};
  return {row,inputs};
}

test('0136 site serialization preserves manual identity on every read even when Inventory name matches',()=>{
  const fn=parseFunction(sourceBetween(sites,'  function rowToMaterial(row){','\n  function rowToService('),{
    getOPT:()=>({inventory_items:[{id:'inv1',inventory_item_id:'inv1',name:'Manual CCTV',sku:'EXACT',stock:7}]}),
    window:{resolveSalesOrderInventorySelection:()=>{throw Error('Manual row must NOT auto-match Inventory');}},
    num:Number,uid:()=> 'manual-stable-id'
  });
  const {row}=fakeRow({manualId:'manual:original',name:'Manual CCTV'});
  const first=fn(row),again=fn(row);
  assert.equal(first.manual_material,true);
  assert.equal(first.source_type,'manual');
  assert.equal(first.inventory_item_id,'manual:original');
  assert.equal(first.name,'Manual CCTV');
  assert.equal(first.sku,null);
  assert.equal(first.stock_at_select,null);
  assert.equal(first.source_key,null);
  assert.equal(again.inventory_item_id,first.inventory_item_id);
  row.dataset.manualId='';
  const fresh=fn(row),freshAgain=fn(row);
  assert.equal(fresh.inventory_item_id,'manual:manual-stable-id');
  assert.equal(freshAgain.inventory_item_id,fresh.inventory_item_id);
  assert.equal(row.dataset.manualId,'manual:manual-stable-id');
});

test('0136 Inventory and Master Package remain inventory/package-backed when user did not select Manual',()=>{
  const inventory={id:'inv1',inventory_item_id:'inv1',name:'Inventory IPC',sku:'IPC',stock:7,source_type:'inventory',unit:'pcs'};
  const fn=parseFunction(sourceBetween(sites,'  function rowToMaterial(row){','\n  function rowToService('),{
    getOPT:()=>({inventory_items:[inventory]}),
    window:{resolveSalesOrderInventorySelection:()=>inventory},
    num:Number,uid:()=> 'new'
  });
  const {row}=fakeRow({name:'Inventory IPC',mode:'inventory',manualMaterial:'0',inventoryId:'inv1',sourceType:'inventory'});
  const item=fn(row);
  assert.equal(item.manual_material,false);
  assert.equal(item.inventory_item_id,'inv1');
  assert.equal(item.source_type,'inventory');
  assert.equal(item.stock_at_select,7);
  row.dataset.sourceType='master_package';
  row.dataset.packageId='pkg-10';
  const pkg=fn(row);
  assert.equal(pkg.source_type,'master_package');
  assert.equal(pkg.package_id,'pkg-10');
  assert.equal(pkg.manual_material,false);
});

test('0136 native Draft addMaterial preserves saved Manual instead of resolving its source_key to Inventory',()=>{
  const rows=[];
  const container={querySelector(){return null;},appendChild(r){rows.push(r)}};
  const elements={};
  const doc={createElement(tag){
    assert.equal(tag,'div');
    const row={dataset:{},className:'',innerHTML:'',querySelector(s){if(s==='.item-search')return{value:'',addEventListener(){}};return null;}};
    return row;
  }};
  const ctx={
    document:doc,OPT:{inventory_items:[{id:'inv-1',inventory_item_id:'inv-1',source_key:'price-same',name:'Inventory auto-selected',sku:'AUTO'}]},
    byId:id=>id==='materialItems'?container:null,
    esc:v=>String(v??''),numberValue:v=>Number(v||0),rp:v=>v,
    bindLineEvents:()=>{},updateTotals:()=>{},renderMaterialResults:()=>{},
    setTimeout:()=>{}
  };
  const fn=parseFunction(sourceBetween(html,'function addMaterial(data = {}) {','\nfunction addService('),ctx);
  fn({inventory_item_id:'manual:old-id',source_type:'manual',source_key:'price-same',manual_material:true,item_name:'Material asli manual',qty:2,unit:'meter',unit_price:125000});
  assert.equal(rows.length,1);
  const row=rows[0];
  assert.equal(row.dataset.manualMaterial,'1');
  assert.equal(row.dataset.manualId,'manual:old-id');
  assert.equal(row.dataset.inventoryId,'');
  assert.equal(row.dataset.catalogId,'');
  assert.equal(row.dataset.sourceType,'manual');
  assert.match(row.innerHTML,/Material asli manual/);
  assert.doesNotMatch(row.innerHTML,/Inventory auto-selected/);
});

test('0136 native Submit does not fuzzy-map explicitly manual material to Inventory and retains qty/price',()=>{
  const inventory={id:'inv-1',inventory_item_id:'inv-1',name:'Camera EZVIZ 4MP',stock:100,sku:'E4MP',unit:'pcs'};
  const {row,inputs}=fakeRow({name:'Camera EZVIZ 4MP',qty:4,unit:'pcs',unit_price:243211,manualId:'manual:original'});
  let lookups=0;
  const values={'salesPic':'sales-1','customer':'Test Customer','phone':'000','customerSource':'Organic','projectName':'Test SO','address':'Test address','notes':''};
  const ctx={
    OPT:{sales_users:[{id:'sales-1',name:'Test Sales'}],inventory_items:[inventory]},
    document:{querySelectorAll:sel=>sel==='.material-row'?[row]:[]},
    byId:id=>({value:values[id]||''}),
    resolveSalesOrderInventorySelection(){lookups++;return inventory;},
    numberValue:v=>Number(v||0),updateTotals:()=>({materialSubtotal:972844,serviceSubtotal:0,grandTotal:972844}),
    getCustomerClassificationSnapshot:()=>({customer_id:null,market_segment:'B2B',sector:'Retail',customer_source:'Organic'})
  };
  const fn=parseFunction(sourceBetween(html,'function collect() {','\nasync function save()'),ctx);
  const first=fn();
  assert.equal(lookups,0);
  assert.equal(first.items.length,1);
  assert.equal(first.items[0].manual_material,true);
  assert.equal(first.items[0].source_type,'manual');
  assert.equal(first.items[0].inventory_item_id,'manual:original');
  assert.equal(first.items[0].name,inputs['.item-search'].value);
  assert.equal(first.items[0].qty,4);
  assert.equal(first.items[0].unit_price,243211);
  assert.equal(first.items[0].sku,null);
  assert.equal(first.items[0].stock_at_select,null);
  const again=fn();
  assert.deepEqual(JSON.parse(JSON.stringify(again.items)),JSON.parse(JSON.stringify(first.items)));
});

test('0136 manual wrapper leaves multi-site rows unmapped to other sites',()=>{
  assert.match(manual,/const siteMode=materialItems\.some\(item=>item\.site_id\|\|item\.site_name\)/);
  assert.match(manual,/if\(!siteMode\)\[\.\.\.document\.querySelectorAll\('\.material-row'\)\]/);
  assert.match(manual,/const existingId=String\(row\.dataset\.manualId\|\|''\)/);
  assert.match(manual,/row\.dataset\.catalogId=''/);
  assert.match(manual,/row\.dataset\.sourceType='manual'/);
  assert.doesNotMatch(read('public/sales-order.html'),/api\/inventory\/stock-decrease/);
});

test('0136 Manual SO survives three consecutive Draft edit/save/reopen cycles without Inventory reassignment',()=>{
  const inventory={id:'inv-1',inventory_item_id:'inv-1',source_key:'linked-source',name:'Kamera CCTV 4MP',sku:'INV-CCTV-4',stock:15,source_type:'inventory'};
  const siteFn=parseFunction(sourceBetween(sites,'  function rowToMaterial(row){','\n  function rowToService('),{
    getOPT:()=>({inventory_items:[inventory]}),
    window:{resolveSalesOrderInventorySelection:()=>{throw Error('Name match must not be used for Manual');}},
    num:Number,uid:()=> 'random-id'
  });
  let persisted={name:'Kamera CCTV 4MP',item_name:'Kamera CCTV 4MP',inventory_item_id:'manual:123',manual_material:true,source_type:'manual',source_key:'linked-source',qty:3,unit:'pcs',unit_price:185000,ppn_applied:true,ppn_rate:11};
  for(let cycle=0;cycle<3;cycle++){
    const created=[];
    const container={querySelector(){return null;},appendChild(row){created.push(row)}};
    const ctx={
      OPT:{inventory_items:[inventory]},
      document:{createElement(){
        const saved=persisted;
        const elements={
          '.item-search':{value:saved.item_name,addEventListener(){}},
          '.qty':{value:String(saved.qty),addEventListener(){}},
          '.unit':{value:saved.unit,addEventListener(){}},
          '.price':{value:String(saved.unit_price),addEventListener(){}},
          '.selected-item':{textContent:'',style:{}},
          '.item-results':{classList:{add(){},remove(){}}},
          '.pxl-material-source':{value:'manual'},
        };
        return {dataset:{},innerHTML:'',className:'',querySelector:s=>elements[s]||null};
      }},
      byId:id=>id==='materialItems'?container:null,
      esc:v=>String(v??''),numberValue:v=>Number(v||0),rp:v=>v,
      bindLineEvents(){},updateTotals(){},renderMaterialResults(){}
    };
    const addFn=parseFunction(sourceBetween(html,'function addMaterial(data = {}) {','\nfunction addService('),ctx);
    addFn(persisted);
    assert.equal(created.length,1);
    const row=created[0];
    row.dataset.ppnApplied=persisted.ppn_applied?'1':'0';
    row.dataset.ppnRate=String(persisted.ppn_rate||0);
    assert.equal(row.dataset.manualMaterial,'1');
    assert.equal(row.dataset.sourceType,'manual');
    persisted=siteFn(row);
    assert.equal(persisted.manual_material,true);
    assert.equal(persisted.inventory_item_id,'manual:123');
    assert.equal(persisted.source_type,'manual');
    assert.equal(persisted.name,'Kamera CCTV 4MP');
    assert.equal(persisted.qty,3);
    assert.equal(persisted.unit_price,185000);
    assert.equal(persisted.ppn_applied,true);
    assert.equal(persisted.ppn_rate,11);
    assert.equal(persisted.source_key,null);
  }
});

test('0136 sales-order HTML delivery really appends manual-mode runtime script exactly once',()=>{
  const force=parseFunction(sourceBetween(loader,'function forceSalesOrderScriptOrder(html){','\nexpress.static='),{
    removeScript:(source,base)=>source.replace(/<script[^>]*src="([^"]*)"[^>]*><\/script>\s*/g,(tag,src)=>src.split('?')[0]===base?'':tag)
  });
  const served=force(html);
  const src='/pxl-urg-0021-sales-order-manual-material-maps.js?v=PXL-URG-0136';
  assert.equal(served.split(src).length-1,1);
  assert.ok(served.lastIndexOf('/pxl-urg-0030-pricing-calculator.js')<served.lastIndexOf(src));
  assert.match(served,/\/pxl-prod-0022ab-sales-order-sites\.js/);
  assert.match(served,/\/pxl-prod-0022d-so-ppn\.js/);
  assert.match(served,/\/pxl-vnext-2c-survey-so-prefill\.js/);
  assert.match(served,/function editSO\(id\)/);
  assert.match(served,/function addMaterial\(data = \{\}\)/);
});
