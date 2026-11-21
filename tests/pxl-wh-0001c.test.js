'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {safeDailyLedger}=require('../pxl-wh-0001c-ledger');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const db=fs.readFileSync(path.join(__dirname,'../db-core.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'../PXL-WH-0001C-MIGRATION.sql'),'utf8');
test('invalid balance remains visible, not misleading 0, and does not break valid items',()=>{
 const result=safeDailyLedger({date:'2026-11-21',items:[
  {id:'good',sku:'PX-GOOD',name:'Good',stock:3},{id:'bad',sku:'PX-BAD',name:'Bad',stock:-9}
 ],transactions:[]});
 assert.equal(result.items.length,2);
 assert.equal(result.invalid_count,1);
 assert.equal(result.quality_warning,true);
 assert.equal(result.items.find(x=>x.sku==='PX-BAD').quality,'invalid_balance');
 assert.equal(result.items.find(x=>x.sku==='PX-BAD').closing,null);
 assert.equal(result.items.find(x=>x.sku==='PX-GOOD').closing,3);
});
test('official SKU derived from PROBUS source key, not legacy inventory sku',()=>{
 assert.match(db,/MANUAL:PROBUS:PX-/);
 assert.match(db,/source_key\.slice\('MANUAL:PROBUS:'\.length\)/);
 assert.match(server,/getWarehouseOfficialCatalog/);
 assert.match(server,/officialById\.get/);
 assert.doesNotMatch(server.slice(server.indexOf("app.get('/api/warehouse/monthly-out'"),server.indexOf('// PXL-URG-0116C — read-only')),/getWarehouseInventoryHistoryItems\(\)/);
});
test('daily usage endpoints only append to dedicated table; no inventory or WO writes',()=>{
 const section=server.slice(server.indexOf('// PXL-WH-0001C: immutable daily USED records'),server.indexOf("app.get('/api/warehouse/inventory-options'"));
 assert.match(section,/insertWarehouseDailyUsage/);
 assert.match(section,/stock_changed:false,wo_changed:false/);
 assert.doesNotMatch(section,/updateInventoryItem|insertInventoryTransaction|updateCrmWorkOrder|updateMRForm/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.warehouse_daily_usage/);
 assert.doesNotMatch(sql,/UPDATE\s+(inventory_items|tickets|crm_work_orders)/i);
});
test('UI includes daily usage input and monthly used distinctly from OUT',()=>{
 assert.match(ui,/Daily Material Usage/);
 assert.match(ui,/daily-usage/);
 assert.match(ui,/stok tidak berubah/);
 assert.match(ui,/\['SKU PX \/ Material','Satuan','IN','OUT','USED'\]/);
 assert.match(ui,/i\.opening==null\?'-'/);
});
