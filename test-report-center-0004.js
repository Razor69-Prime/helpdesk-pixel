'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('./report-center-sales');
const a='f093ba8d-dd95-4b7b-86fa-2669c966df4d',b='4ab666aa-c5b5-4696-928c-3728e3bb8052';
const rows=[
 {pic_name:'Ana',customer_name:'Pixel A',classification:'B2B',outlet_id:a,gross_amount:100,hpp_amount:60,net_amount:30},
 {pic_name:'Ana',customer_name:'pixel a',classification:'B2C',outlet_id:b,gross_amount:300,hpp_amount:200,net_amount:70},
 {pic_name:'',customer_name:'Pixel B',classification:'B2BG',outlet_id:a,gross_amount:200,hpp_amount:110,net_amount:70},
 {pic_name:'Budi',customer_name:'Pixel C',classification:'B2G',outlet_id:b,gross_amount:400,hpp_amount:300,net_amount:60}
];
const deps={readRows:async()=>rows,listOutlets:async()=>[{id:a,name:'Buduk'},{id:b,name:'Lukluk'}]};
(async()=>{
 assert.equal(Object.keys(R.REPORTS).length,6);
 for(const code of Object.keys(R.REPORTS)){
  const d=await R.getData(code,{},deps);
  assert.equal(d.source,'Accounting');assert(d.readOnly);assert.equal(d.summary.transactions,4);
  assert.equal(d.summary.omzet,1000);assert.match(d.note,/bukan conversion rate/);
 }
 const pic=await R.getData('sales-pic',{},deps);
 assert.equal(pic.rows.find(r=>r['Sales PIC']==='Ana')['Omzet (Rp)'],400);
 assert.equal(pic.rows.find(r=>r['Sales PIC']==='PIC Belum Diisi').Transaksi,1);
 const seg=await R.getData('sales-segment',{},deps);assert.equal(seg.rows.length,4);
 const outlet=await R.getData('sales-outlet',{},deps);assert.equal(outlet.rows.length,2);
 const matrix=await R.getData('sales-pic-segment',{},deps);assert.equal(matrix.rows.length,4);
 const customers=await R.getData('sales-customer',{},deps);assert.equal(customers.rows.length,3);
 const repeat=await R.getData('sales-repeat',{},deps);assert.equal(repeat.rows.length,1);assert.equal(repeat.rows[0].Transaksi,2);assert.equal(repeat.repeatCustomers,1);
 await assert.rejects(R.getData('sales-conversion',{},deps),{status:404});
 const source=fs.readFileSync('report-center-sales.js','utf8');
 assert(!/getSalesOrders|getInventoryItems|conversion_rate/.test(source));
 const ui=fs.readFileSync('public/report-center.html','utf8');
 for(const x of ui.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(x[1]);
 assert(ui.includes("chosen.startsWith('sales-')"));
 console.log('PASS PXL-RPT-0004: PIC, segment, outlet, matrix, customers, repeat, read-only, no ungrounded conversion');
})().catch(e=>{console.error(e);process.exitCode=1;});
