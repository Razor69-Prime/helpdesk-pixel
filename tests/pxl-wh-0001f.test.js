'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/pxl-wh-0001-ui.js'),'utf8');
test('autofill matcher is actually within public static directory',()=>{
 const scripts=[...html.matchAll(/<script src="(\/pxl-wh-[^"]+\.js)\?v=PXL-WH-0001[FGHIJ]"/g)].map(x=>x[1]);
 assert.ok(scripts.includes('/pxl-wh-0001d-matching.js'));
 assert.ok(scripts.includes('/pxl-wh-0001-ui.js'));
 for(const script of scripts)assert.ok(fs.existsSync(path.join(root,'public',script.slice(1))),script+' missing in public');
 assert.ok(html.indexOf('/pxl-wh-0001d-matching.js')<html.indexOf('/pxl-wh-0001-ui.js'));
});
test('autofill shows loading error separately from SO with no material',()=>{
 assert.match(ui,/Pencocokan material belum termuat/);
 assert.match(ui,/matcher\.proposals\(record,inventory\)/);
 assert.match(ui,/Belum ada material pada SO\/WO tersebut/);
});
test('real linked SO and WO material is offered to user',()=>{
 const {build}=require('../pxl-wh-0001-monitor');
 const {proposals}=require('../public/pxl-wh-0001d-matching');
 const list=build({salesOrders:[{id:'so1',so_number:'SO-2026-000130',items:[{qty:5,source_key:'MANUAL:PROBUS:PX-CAM-001',inventory_item_id:'cam1',name:'Camera CCTV'}]}],tickets:[{id:'wo1',wo_number:'WO-2026-000293',sales_order_id:'so1'}]});
 assert.equal(list.length,1);
 const offers=proposals(list[0],[{id:'cam1',sku:'PX-CAM-001',name:'Camera CCTV'}]);
 assert.equal(offers.length,1);
 assert.equal(offers[0].sku,'PX-CAM-001');
 assert.equal(offers[0].planned_qty,5);
});
