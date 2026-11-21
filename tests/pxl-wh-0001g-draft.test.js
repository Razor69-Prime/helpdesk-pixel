'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizeLines,asUsedRows}=require('../pxl-wh-0001g-draft');
const catalog=[{id:'42',sku:'PX-CCTV-001',name:'Camera 4MP',unit:'pcs'},{id:'43',sku:'PX-KAB-002',name:'Kabel LAN',unit:'meter'}];
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const db=fs.readFileSync(path.join(__dirname,'../db-core.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'../PXL-WH-0001G-MIGRATION.sql'),'utf8');
test('draft saves all rows, including blank USED, without changing stock',()=>{
 const lines=normalizeLines([{sku:'PX-CCTV-001',qty_used:null,planned_qty:3,note:'Bawa ke site'},{sku:'PX-KAB-002',qty_used:2,planned_qty:10}],catalog);
 assert.equal(lines.length,2);assert.equal(lines[0].qty_used,null);assert.equal(lines[1].qty_used,2);
 assert.equal(lines[0].planned_qty,3);assert.equal(lines[1].unit,'meter');
 assert.match(sql,/warehouse_usage_documents/);
 assert.doesNotMatch(sql,/UPDATE\s+(?:public\.)?(?:inventory_items|tickets|crm_work_orders|warehouse_daily_usage)/i);
});
test('final cannot contain missing or zero USED; invalid catalog, duplicates rejected',()=>{
 assert.throws(()=>normalizeLines([{sku:'PX-CCTV-001',qty_used:null}],catalog,{final:true}),/Qty USED/);
 assert.throws(()=>normalizeLines([{sku:'PX-CCTV-001',qty_used:0}],catalog,{final:true}),/Qty USED/);
 assert.throws(()=>normalizeLines([{sku:'PX-FAKE-001',qty_used:1}],catalog),/katalog PROBUS/);
 assert.throws(()=>normalizeLines([{sku:'PX-CCTV-001',qty_used:1},{sku:'PX-CCTV-001',qty_used:1}],catalog),/duplikat/);
 assert.equal(normalizeLines([{sku:'PX-CCTV-001',qty_used:1}],catalog,{final:true}).length,1);
});
test('ONLY final document lines feed reports, not drafts',()=>{
 const base={warehouse_id:1,source_key:'so:1',usage_date:'2026-11-21',lines:[{sku:'PX-CCTV-001',item_name:'Camera',unit:'pcs',qty_used:4,note:''}]};
 const data=asUsedRows([{...base,id:5,status:'DRAFT'},{...base,id:6,status:'FINAL',finalized_by:'Gudang'}]);
 assert.equal(data.length,1);assert.equal(data[0].id,'WH-DOC-6-0');
 assert.equal(data[0].qty_used,4);assert.equal(data[0].actor_name,'Gudang');
 assert.match(db,/status:'FINAL'/);
});
test('draft edit is optimistic-revision checked and finalized document immutable',()=>{
 assert.match(db,/revision=eq\./);
 assert.match(db,/status=eq.DRAFT/);
 assert.match(db,/finalizeWarehouseUsageDraft/);
 assert.match(server,/if\(doc.status!=='DRAFT'\)return res.status\(409\)/);
 assert.match(server,/Draft sudah berubah/);
 assert.match(server,/usage_date:newDate/);
 assert.match(server,/stock_changed:false,wo_changed:false/);
});
test('one submit creates a draft, next edit updates draft, finalization separate action',()=>{
 assert.match(ui,/Simpan Semua sebagai Draft/);
 assert.match(ui,/Buka \/ Revisi/);
 assert.match(ui,/Finalisasi Pemakaian/);
 assert.match(ui,/req\(method,path,body\)/);
 assert.match(ui,/daily-usage\/drafts/);
 assert.match(ui,/daily-usage\/drafts\/'.*?\/finalize/);
 assert.doesNotMatch(ui,/req\('POST','daily-usage\/batch'/);
});
test('backend obsolete immediate used endpoint does not permit bypassing draft-first',()=>{
 const a=server.slice(server.indexOf("app.post('/api/warehouse/daily-usage',"),server.indexOf("app.get('/api/warehouse/inventory-options'"));
 assert.match(a,/status\(410\)/);
 assert.doesNotMatch(a,/db\.insertWarehouseDailyUsageBatch\(/);
});
