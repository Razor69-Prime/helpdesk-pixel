'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('./report-center-products'),api=require('./report-center-api');
const items=[
 {id:'a',name:'Cam A',sku:'AAA',category:'CCTV',unit:'pcs',stock:5,min_stock:6,is_active:true},
 {id:'b',name:'Cam B',sku:'BBB',category:'CCTV',unit:'pcs',stock:20,min_stock:3,is_active:true},
 {id:'c',name:'Cam C',sku:'CCC',category:'CCTV',unit:'pcs',stock:3,min_stock:1,is_active:true}
];
const orders=[
 {id:'1',status:'approved',approved_at:'2026-11-04T02:00:00Z',items:[{inventory_item_id:'a',qty:2,line_total:800},{sku:'BBB',qty:4,line_total:1500}]},
 {id:'2',status:'draft',created_at:'2026-11-05',items:[{inventory_item_id:'a',qty:99,line_total:100000}]},
 {id:'3',status:'cancelled',created_at:'2026-11-05',items:[{inventory_item_id:'a',qty:99,line_total:100000}]},
 {id:'4',status:'approved',approved_at:'2026-11-06T02:00:00Z',items:[{sku:'AAA',qty:3,line_total:1200},{sku:'UNKNOWN',qty:50,line_total:5000}]}
];
(async()=>{
 const ranking=R.salesOrders(orders,items,'2026-11-01','2026-11-30','qty');
 assert.equal(ranking.rows.length,2);assert.equal(ranking.rows[0].SKU,'AAA');assert.equal(ranking.rows[0].Qty,5);assert.equal(ranking.summary.value,3500);
 assert.match(ranking.note,/1 baris SO/);
 const byValue=R.salesOrders(orders,items,'2026-11-01','2026-11-30','value');
 assert.equal(byValue.rows[0].SKU,'AAA');
 const transactions=[{item_id:'a',transaction_type:'REQUEST',qty:-5},{item_id:'a',transaction_type:'OPNAME',qty:-900},{item_id:'b',transaction_type:'REQUEST',qty:-1}];
 const fast=R.moving(items,transactions,'fast');assert.equal(fast.rows[0].SKU,'AAA');assert.equal(fast.rows[0]['Qty Keluar'],5);
 const slow=R.moving(items,transactions,'slow');assert.equal(slow.rows[0].SKU,'BBB');
 const dead=R.moving(items,transactions,'dead');assert.equal(dead.rows.length,1);assert.equal(dead.rows[0].SKU,'CCC');
 assert.equal(R.lowStock(items).rows.length,1);
 let seen=null;const fake=async(url,opts)=>{seen={url,opts};return {ok:true,json:async()=>[{item_id:'a',transaction_type:'REQUEST',qty:-2,created_at:'2026-11-02T00:00:00Z'}]};};
 const logs=await R.readMovements({from:'2026-11-01',to:'2026-11-30'},{fetch:fake,config:{POSTGREST_URL:'https://test.invalid',POSTGREST_KEY:'test'}});
 assert.equal(logs.length,1);assert.equal(seen.opts.method,'GET');assert(seen.url.includes('transaction_type=eq.REQUEST'));
 const db={getInventoryItems:async()=>items,getSalesOrders:async()=>orders};
 const data=await R.getData(db,'prod-so-qty',{from:'2026-11-01',to:'2026-11-30'});assert.equal(data.rows[0].Qty,5);assert(data.readOnly);
 const source=fs.readFileSync('public/report-center.html','utf8');for(const m of source.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);assert(source.includes('d.note||'));
 assert(Object.keys(R.REPORTS).length===6);
 assert.match(fs.readFileSync('report-center-api.js','utf8'),/superadminOnly/);
 console.log('PASS PXL-RPT-0003: approved SO, SKU join, stock movement categories, GET-only API, source disclosures, UI');
})().catch(e=>{console.error(e);process.exitCode=1});
