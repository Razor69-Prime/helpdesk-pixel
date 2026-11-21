'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {proposals,matchOfficial}=require('../public/pxl-wh-0001d-matching');
const html=fs.readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8');
const ui=fs.readFileSync(require('node:path').join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const server=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
const catalog=[{id:'inv1',sku:'PX-CCTV-001',name:'Kamera CCTV 4MP',unit:'pcs'},{id:'inv2',sku:'PX-CCTV-002',name:'Kamera CCTV 2MP',unit:'pcs'}];
test('autofill resolves by linked inventory ID and official SKU without fuzzy guessing',()=>{
 assert.equal(matchOfficial({inventory_item_id:'inv1',sku:'OLD-001'},catalog).item.sku,'PX-CCTV-001');
 assert.equal(matchOfficial({sku:'PX-CCTV-002'},catalog).item.name,'Kamera CCTV 2MP');
 assert.equal(matchOfficial({name:'Kamera CCTV 4mp'},catalog).item.sku,'PX-CCTV-001');
 assert.equal(matchOfficial({name:'CCTV'},catalog),null);
});
test('autofill shows both SO and MR material, unmatched material remains unselected',()=>{
 const p=proposals({items:[{name:'Kamera CCTV 4MP',inventory_item_id:'inv1',qty:4,source:'SO'},{name:'Kamera Tidak Terdaftar',qty:2,source:'MR'}],manual_items:[{sku:'PX-CCTV-002',name:'Kamera CCTV 2MP',qty:1,source:'MANUAL'}]},catalog);
 assert.equal(p.length,3);assert.equal(p[0].sku,'PX-CCTV-001');assert.equal(p[0].planned_qty,4);
 assert.equal(p[1].sku,'');assert.equal(p[1].reason,'unmapped');assert.equal(p[1].requires_confirmation,true);
 assert.equal(p[2].sku,'PX-CCTV-002');
});
test('name appears before SKU and PROBUS badge appears on dynamic search results',()=>{
 assert.match(ui,/materialLabel=item=>'<span class="wh-catalog-name">'/);
 assert.match(ui,/wh-catalog-meta/);assert.match(ui,/wh-probus/);
 assert.match(ui,/wh-catalog-option/);assert.match(ui,/item.name\+' '\+item.sku/);
 assert.match(ui,/draftLines.push/);
 assert.match(ui,/proposals\(record,inventory\)/);
});
test('SO and WO both accepted and daily usage does not auto-submit from suggestions',()=>{
 assert.match(ui,/r\.wo_number\|\|r\.so_number/);
 assert.match(server,/if\(!wh\?\.so_number&&!wh\?\.wo_number\)/);
 assert.match(ui,/Pilih SO\/WO/);
 assert.match(ui,/Qty rencana bukan Qty USED/);
 assert.match(ui,/picker\.getSelected\(\)/);
 assert.match(ui,/\['materials','Material per SO \/ WO'\]/) // ensure old tab is retained
});
test('matching helper loads before Warehouse UI and UI cache version changes',()=>{
 assert.ok(html.indexOf('pxl-wh-0001d-matching.js?v=PXL-WH-0001F')>=0);
 assert.ok(html.indexOf('pxl-wh-0001d-matching.js?v=PXL-WH-0001F')<html.indexOf('pxl-wh-0001-ui.js?v=PXL-WH-0001G'));
});
