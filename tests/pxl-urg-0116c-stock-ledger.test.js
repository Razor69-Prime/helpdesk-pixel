'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {buildDailyLedger,localDate,validDate}=require('../pxl-urg-0116c-stock-ledger');
const item={id:'cam1',name:'CCTV',unit:'pcs',stock:85};
const tx=(id,at,qty,balance_after)=>({id,item_id:'cam1',created_at:at,qty,balance_after,transaction_type:qty>0?'RESTOCK':'ISSUE',reference:id});
test('historical stock computes start, IN, OUT, closing using signed ledger',()=>{
 const r=buildDailyLedger({date:'2026-11-16',items:[item],transactions:[tx('c','2026-11-16T07:00:00Z',-15,85),tx('a','2026-11-15T09:00:00Z',20,120),tx('b','2026-11-16T02:30:00Z',-20,100)]});
 assert.deepEqual([r.items[0].opening,r.items[0].incoming,r.items[0].outgoing,r.items[0].closing],[120,0,35,85]);
 assert.equal(r.transaction_count,2);assert.equal(r.quality_warning,false);
});
test('daily boundaries are Asia/Makassar, not UTC',()=>{
 assert.equal(localDate('2026-11-15T16:00:00Z'),'2026-11-16');
 assert.equal(localDate('2026-11-16T15:59:59Z'),'2026-11-16');
 assert.equal(localDate('2026-11-16T16:00:00Z'),'2026-11-17');
 const r=buildDailyLedger({date:'2026-11-16',items:[item],transactions:[tx('a','2026-11-15T16:00:00Z',10,95),tx('b','2026-11-16T16:00:00Z',-10,85)]});
 assert.equal(r.items[0].opening,85);assert.equal(r.items[0].incoming,10);assert.equal(r.items[0].outgoing,0);
});
test('no transaction on date takes last historical balance',()=>{
 const r=buildDailyLedger({date:'2026-11-16',items:[item],transactions:[tx('a','2026-11-14T02:00:00Z',10,95),tx('b','2026-11-18T03:00:00Z',-10,85)]});
 assert.deepEqual([r.items[0].opening,r.items[0].closing,r.items[0].quality],[95,95,'verified']);
});
test('historical date before first transaction derives balance from first future movement',()=>{
 const r=buildDailyLedger({date:'2026-11-12',items:[item],transactions:[tx('a','2026-11-14T02:00:00Z',10,95)]});
 assert.equal(r.items[0].opening,85);assert.equal(r.items[0].closing,85);
});
test('no history and corrupted balances do not silently pass as verified',()=>{
 const empty=buildDailyLedger({date:'2026-11-16',items:[item],transactions:[]});
 assert.equal(empty.items[0].quality,'no_transaction_history');assert.equal(empty.quality_warning,true);
 const mismatch=buildDailyLedger({date:'2026-11-16',items:[item],transactions:[tx('a','2026-11-16T01:00:00Z',10,120),tx('b','2026-11-16T02:00:00Z',-4,105)]});
 assert.equal(mismatch.items[0].quality,'balance_mismatch');assert.equal(mismatch.quality_warning,true);
});
test('date input validation rejects invalid dates',()=>{
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-11-16'),true);assert.equal(validDate('2026-11-16T00:00:00Z'),false);
});
test('warehouse endpoint is read only, permissioned and separate from WO closing',()=>{
 const server=read('server.js'),db=read('db-core.js'),ui=read('public/pxl-urg-0116b-warehouse-ui.js');
 const block=server.slice(server.indexOf("app.get('/api/warehouse/stock-ledger'"),server.indexOf('// PXL-URG-0116B'));
 assert.match(block,/if\(!reminder.canView\(req.session\?\.user\)\)return res.status\(403\)/);
 assert.match(block,/db\.getInventoryLedgerHistory\(\)/);assert.match(block,/db\.getInventoryItems\(\)/);
 assert.doesNotMatch(block,/updateTicket|updateMRForm|insertInventoryTransaction|updateInventoryItem/);
 assert.match(db,/async function getInventoryLedgerHistory/);assert.match(db,/offset=\$\{offset\}/);
 assert.match(db,/Riwayat Inventory melebihi batas aman laporan/);
 assert.match(ui,/function loadStockLedger/);assert.match(ui,/Stock IN \/ OUT Harian/);
});
