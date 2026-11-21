'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {build}=require('../pxl-wh-0001-monitor');
const source=fs.readFileSync(require('node:path').join(__dirname,'../server.js'),'utf8');
const db=fs.readFileSync(require('node:path').join(__dirname,'../db-core.js'),'utf8');
test('all SO and WO statuses appear, even with no MR or items',()=>{
 const rows=build({salesOrders:[{id:'so1',so_number:'SO-1',status:'draft'},{id:'so2',so_number:'SO-2',status:'cancelled'}],tickets:[{id:'wo1',wo_number:'WO-1',status:'on progress',technicians:['A','B']},{id:'wo2',wo_number:'WO-2',status:'done'}]});
 assert.equal(rows.length,4);
 assert.deepEqual(new Set(rows.map(r=>r.status)),new Set(['draft','cancelled','on progress','done']));
 assert.deepEqual(rows.find(r=>r.wo_number==='WO-1').technicians,['A','B']);
});
test('related SO and WO share one record and MR supplies materials',()=>{
 const rows=build({salesOrders:[{id:'so1',so_number:'SO-1',status:'approved',items:[{inventory_item_id:'inv1',name:'Camera',qty:2}]}],tickets:[{id:'w1',wo_number:'WO-1',sales_order_id:'so1'}],workOrders:[{id:'cw1',ticket_id:'w1',sales_order_id:'so1',wo_number:'WO-1'}],crmRequests:[{id:'mr1',mr_number:'MR-1',work_order_id:'cw1',items:[{inventory_item_id:'inv1',name:'Camera',qty_out:3}]}]});
 assert.equal(rows.length,1);assert.deepEqual(rows[0].mr_numbers,['MR-1']);
 assert.equal(rows[0].items[0].qty,3);
});
test('WO linked through its number to an SO still has one Warehouse record',()=>{
 const rows=build({salesOrders:[{id:'so1',so_number:'SO-1',status:'draft'}],workOrders:[{id:'cw1',sales_order_id:'so1',wo_number:'WO-1',status:'on_progress'}],tickets:[{id:'t1',wo_number:'WO-1',status:'done',technicians:['Dandi','Revan']}]});
 assert.equal(rows.length,1);assert.equal(rows[0].wo_number,'WO-1');assert.equal(rows[0].so_number,'SO-1');assert.deepEqual(rows[0].technicians,['Dandi','Revan']);
});
test('CRM WO without SO link inherits ticket SO and avoids duplicates',()=>{
 const rows=build({salesOrders:[{id:'so1',so_number:'SO-1',status:'draft'}],tickets:[{id:'t1',wo_number:'WO-1',sales_order_id:'so1',status:'done'}],workOrders:[{id:'cw1',ticket_id:'t1',wo_number:'WO-1',status:'on_progress'}]});
 assert.equal(rows.length,1);assert.equal(rows[0].so_status,'draft');assert.equal(rows[0].wo_status,'done');
});
test('Warehouse API is separate and does not write inventory, SO, WO or MR',()=>{
 const section=source.slice(source.indexOf('// PXL-WH-0001 — Warehouse-only endpoints'),source.indexOf('// PXL-URG-0116C — read-only historical'));
 assert.match(section,/getWarehouseSourceData/);
 assert.match(section,/warehouse\/monitor/);
 assert.doesNotMatch(section,/db\.(?:updateSalesOrder|updateCrmWorkOrder|issueInventoryMaterialRequest|updateMRForm|updateInventoryItem)/);
 assert.match(db,/createWarehouseMonitorRecords/);
 assert.match(db,/getWarehouseSourceData/);
});
test('migration touches only dedicated Warehouse tables',()=>{
 const sql=fs.readFileSync(require('node:path').join(__dirname,'../PXL-WH-0001-MIGRATION.sql'),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.warehouse_monitor_records/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.warehouse_stock_checks/);
 assert.doesNotMatch(sql,/UPDATE\s+(?:public\.)?(?:inventory_items|sales_orders|crm_work_orders|tickets)/i);
});
