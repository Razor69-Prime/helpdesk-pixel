'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {isProbus,officialSku,selectOfficialCatalog}=require('../pxl-urg-0116e-probus-catalog');
const active=[{source_key:'MANUAL:PROBUS:PX-CA-001',item_name:'Camera Official',price:100,is_active:true},{source_key:'MANUAL:PROBUS:PX-CA-002',item_name:'Official Unmapped',price:90,is_active:true},{source_key:'CCTV|CCTV!A11',item_name:'Legacy Pricelist',price:80,is_active:true},{source_key:'MANUAL:PROBUS:PX-OLD',item_name:'Inactive PROBUS',price:100,is_active:false}];
const inv=[{id:'id-existing',name:'Camera Official',sku:'CAM-IPC-0008',stock:15},{id:'id-legacy',name:'Legacy Already Used In WO',sku:'CAM-IPC-0009',stock:5},{id:'id-old',name:'Inactive PROBUS',sku:'CAM-IPC-0010',stock:1}];
const maps=[{inventory_item_id:'id-existing',source_key:'MANUAL:PROBUS:PX-CA-001'},{inventory_item_id:'id-legacy',source_key:'CCTV|CCTV!A11'},{inventory_item_id:'id-old',source_key:'MANUAL:PROBUS:PX-OLD'}];
test('official catalog includes only active PROBUS and preserves existing item IDs',()=>{
 const out=selectOfficialCatalog({inventory:inv,prices:active,maps});
 assert.deepEqual(out.officialInventory.map(x=>x.id),['id-existing']);
 assert.deepEqual(out.officialUnmapped.map(x=>x.source_key),['MANUAL:PROBUS:PX-CA-002']);
 assert.equal(out.byInventory.get('id-existing').source_key,'MANUAL:PROBUS:PX-CA-001');
 assert.equal(out.byInventory.has('id-legacy'),false);
 assert.equal(inv.length,3);assert.equal(maps.length,3);
});
test('SKU PX is derived from PROBUS source key, without changing Inventory SKU',()=>{
 assert.equal(isProbus('MANUAL:PROBUS:PX-CA-001'),true);
 assert.equal(isProbus('CCTV|CCTV!A11'),false);
 assert.equal(officialSku('MANUAL:PROBUS:PX-CA-001'),'PX-CA-001');
 assert.equal(officialSku('CCTV|CCTV!A11'),'');
 assert.equal(inv[0].sku,'CAM-IPC-0008');
});
test('all known material fast-search modules use the common filtered catalog endpoint',()=>{
 const modules=['public/sales-order.html','public/index.html','public/pxl-stg-0004d.js','public/pxl-vnext-2c-survey-flow.js','public/pxl-urg-0045-master-pricelist-so-bridge.js','public/pxl-pr-inv-0001.js','public/package-recipes.html'];
 for(const file of modules)assert.match(read(file),/material-catalog/,file);
 const code=read('pxl-urg-0043-master-pricelist-cache.js');
 const section=code.slice(code.indexOf("app.get('/api/material-catalog'"),code.indexOf("app.get('/api/master-pricelist/catalog'"));
 assert.match(section,/selectOfficialCatalog/);
 assert.match(section,/officialInventory\.map/);
 assert.match(section,/officialUnmapped\.forEach/);
 assert.match(section,/sku:officialSku\(price\?\.source_key\)/);
 assert.match(section,/legacy_sku:inv\.sku/);
 assert.match(section,/hidden_non_probus:true/);
 assert.doesNotMatch(section,/updateInventory|updateTicket|updateMRForm|restFetch\('PATCH'/);
});
test('SO fast search fails closed, while saved non-PROBUS draft lines remain editable',()=>{
 const so=read('public/sales-order.html');
 assert.match(so,/const unifiedItems=Array\.isArray\(unified\.items\)\?unified\.items:\[\]/);
 assert.doesNotMatch(so,/unified\.items\.length\?unified\.items:/);
 assert.match(so,/row\.dataset\.legacyExisting/);
 assert.match(so,/row\.dataset\.legacyName/);
 assert.match(so,/legacyExisting = !!editId/);
 assert.match(so,/!manualMaterial && !legacyExisting/);
 assert.match(so,/row\.dataset\.legacyExisting = '0'/);
 assert.match(so,/Arsip non-PROBUS/);
});
test('saved package recipes keep their inventory linkage even when catalog search hides legacy item',()=>{
 const pkg=read('public/package-recipes.html');
 assert.match(pkg,/if\(!item\)\{if\(!silent\)tr\.dataset\.inventoryItemId=''/);
 assert.match(pkg,/silent&&tr\.dataset\.inventoryItemId\?'Item historis non-PROBUS/);
 assert.match(pkg,/inventory_item_id:tr\.dataset\.inventoryItemId\|\|null/);
});
test('WO flow and existing historical data remain unchanged by 0116E',()=>{
 const {execFileSync}=require('node:child_process');
 const changes=execFileSync('git',['diff','--name-only','origin/main'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 assert.ok(!changes.includes('pxl-stg-0008a30-flow-guard.js'));
 assert.ok(!changes.includes('server.js'));
 assert.ok(!changes.includes('db-core.js'));
 assert.ok(!changes.some(x=>x.endsWith('.sql')));
});

test('real catalog HTTP handler builds only PROBUS options; original legacy inventory untouched',async()=>{
 const routes={};const app={get:(route,...handlers)=>{routes[route]=handlers.at(-1)},post:()=>{}};
 const dbFile=require.resolve('../db');const cached=require.cache[dbFile];
 require.cache[dbFile]={id:dbFile,filename:dbFile,loaded:true,exports:{getInventoryItems:async()=>inv}};
 const oldFetch=global.fetch;
 global.fetch=async url=>{
   const response=String(url).includes('master_pricelist_inventory_map')?maps:active.filter(x=>x.is_active!==false);
   return {ok:true,status:200,text:async()=>JSON.stringify(response)};
 };
 try{
   const install=require('../pxl-urg-0043-master-pricelist-cache');
   install(app,{requireAuth:(req,res,next)=>next(),db:{getPackageRecipes:async()=>[]}});
   let body,status=200,cacheHeader='';
   const res={status(n){status=n;return this},setHeader(k,v){if(k==='Cache-Control')cacheHeader=v},json(x){body=x;return this}};
   await routes['/api/material-catalog']({session:{user:{role:'superadmin'}}},res);
   assert.equal(status,200);assert.equal(cacheHeader,'no-store');
   assert.deepEqual(body.items.map(x=>x.name),['Camera Official','Official Unmapped']);
   assert.deepEqual(body.items.map(x=>x.sku),['PX-CA-001','PX-CA-002']);
   assert.equal(body.items[0].legacy_sku,'CAM-IPC-0008');
   assert.equal(body.items[0].inventory_item_id,'id-existing');
   assert.equal(body.items[1].inventory_available,false);
   assert.equal(body.hidden_non_probus,true);
   assert.equal(inv[1].name,'Legacy Already Used In WO');
   assert.equal(inv[1].stock,5);
 }finally{
   global.fetch=oldFetch;
   if(cached)require.cache[dbFile]=cached;else delete require.cache[dbFile];
 }
});
