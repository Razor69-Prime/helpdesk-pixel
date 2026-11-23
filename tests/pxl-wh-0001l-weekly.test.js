'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {monday,shift,buildWeeklyLedger}=require('../pxl-wh-0001l-weekly');
const {safeDailyLedger}=require('../pxl-wh-0001c-ledger');
const exp=require('../public/pxl-wh-0001i-export');
const ui=fs.readFileSync(path.join(__dirname,'../public/pxl-wh-0001-ui.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const items=[{id:'one',sku:'PX-A',name:'Camera A',stock:8,unit:'pcs'},{id:'two',sku:'PX-B',name:'Cable B',stock:0,unit:'meter'}];
const history=[
 {id:'1',item_id:'one',qty:5,balance_after:13,created_at:'2026-11-23T02:00:00Z'},
 {id:'2',item_id:'one',qty:-3,balance_after:10,created_at:'2026-11-24T04:00:00Z'},
 {id:'3',item_id:'one',qty:-2,balance_after:8,created_at:'2026-11-26T06:00:00Z'}
];
test('week selection aligns to Monday through Sunday and across months/year',()=>{
 assert.equal(monday('2026-11-23'),'2026-11-23');
 assert.equal(monday('2026-11-29'),'2026-11-23');
 assert.equal(monday('2026-12-01'),'2026-11-30');
 assert.equal(shift('2026-12-28',6),'2027-01-03');
 assert.throws(()=>monday('2026-02-30'),/invalid|tidak valid/i);
});
test('weekly beginning to ending accumulates exact daily movement with same ledger',()=>{
 const week=buildWeeklyLedger({items,transactions:history,weekStart:'2026-11-23',today:'2026-12-01'});
 const row=week.items[0],first=safeDailyLedger({items,transactions:history,date:'2026-11-23'}).items[0];
 const end=safeDailyLedger({items,transactions:history,date:'2026-11-29'}).items[0];
 assert.equal(week.week_end,'2026-11-29');
 assert.equal(week.partial,false);
 assert.equal(row.opening,first.opening);
 assert.equal(row.closing,end.closing);
 assert.equal(row.opening,8);
 assert.equal(row.incoming,5);
 assert.equal(row.outgoing,5);
 assert.equal(row.closing,8);
 assert.equal(row.moved,true); // net zero still movement
 assert.equal(week.movement_count,1);
 assert.equal(week.items[1].moved,false);
});
test('current week stops at today rather than projecting future movements',()=>{
 const week=buildWeeklyLedger({items,transactions:history,weekStart:'2026-11-23',today:'2026-11-24'});
 assert.equal(week.through_date,'2026-11-24');
 assert.equal(week.partial,true);
 assert.equal(week.items[0].closing,10);
 assert.equal(week.items[0].outgoing,3);
});
test('future weeks and non-Monday inputs are rejected',()=>{
 assert.throws(()=>buildWeeklyLedger({items,weekStart:'2026-11-24',today:'2026-11-24'}),/Senin/);
 assert.throws(()=>buildWeeklyLedger({items,weekStart:'2026-11-30',today:'2026-11-24'}),/mendatang/);
});
test('invalid negative inventory balance is flagged but report still shows other items',()=>{
 const week=buildWeeklyLedger({items:[{id:'invalid',sku:'PX-Z',name:'Bad',stock:-3},{id:'valid',sku:'PX-Y',name:'Good',stock:2}],transactions:[],weekStart:'2026-11-23',today:'2026-11-23'});
 assert.equal(week.invalid_count,1);
 assert.equal(week.items[0].quality,'invalid_balance');
 assert.equal(week.items[0].closing,null);
 assert.equal(week.items[1].closing,2);
});
test('daily and weekly UI highlight movement, warning has higher priority',()=>{
 assert.match(ui,/stockMoved=item=>/);
 assert.match(ui,/wh-stock-moved/);
 assert.match(ui,/wh-stock-warning/);
 assert.match(ui,/stockColor\(item\)/);
 assert.match(ui,/renderWeekly\(\)/);
 assert.match(ui,/Tampilkan Minggu/);
 assert.match(ui,/data\.partial/);
});
test('weekly export includes selected period and movement status',()=>{
 const week=buildWeeklyLedger({items,transactions:history,weekStart:'2026-11-23',today:'2026-12-01'});
 const sheets=exp.weekly(week);
 assert.equal(sheets[0].name,'Weekly Stock');
 assert.equal(sheets[0].rows[0]['Awal Minggu'],'2026-11-23');
 assert.equal(sheets[0].rows[0]['IN'],5);
 assert.equal(sheets[0].rows[0]['OUT'],5);
 assert.equal(sheets[0].rows[0]['Pergerakan'],'Ada pergerakan');
});
test('weekly is guarded read-only endpoint and browser reloads scripts',()=>{
 const section=server.slice(server.indexOf("app.get('/api/warehouse/weekly-stock'"),server.indexOf("// PXL-URG-0116B — warehouse admin queue"));
 assert.match(section,/reminder\.canView\(req\.session\?\.user\)/);
 assert.match(section,/getInventoryLedgerHistory/);
 assert.match(section,/buildWeeklyLedger/);
 assert.doesNotMatch(section,/app\.(post|patch|put|delete)\(/);
 assert.match(html,/pxl-wh-0001-ui\.js\?v=PXL-WH-0001L/);
 assert.match(html,/pxl-wh-0001i-export\.js\?v=PXL-WH-0001L/);
});
