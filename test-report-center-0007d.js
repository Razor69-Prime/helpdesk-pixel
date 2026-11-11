'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const p=require('./report-center-products');
const r=(description,category,omzet,net,segment='B2C')=>({transaction_description:description,product_category:category,gross_amount:omzet,net_amount:net,hpp_amount:omzet*.6,dpp_amount:omzet*.9,ppn_amount:omzet*.1,sales_type:'BARANG',classification:segment});
const goods=[
 r('Ezviz H8C 2MP','CCTV',100,40),r('ezviz   h8c 2mp','CCTV',200,90),
 r('EZVIZ H8C 4MP','CCTV',150,30),r('Ezviz','CCTV',500,100),
 r('Hikvision DS-2CD1121G0-I','CCTV',250,100),
 r('Penjualan Penambahan 8 Site CCTV Desa Cemagi','CCTV',1000,150),
 r('Other Brand','CCTV',50,10),r('Dahua DH-XVR1B04-I/T','DVR',400,100),
 r('Imou MSD 64GB','SD Card',120,25)
];
(async()=>{
 assert.deepEqual(p.parseBrandModel(goods[0]),{brand:'EZVIZ',model:'H8C 2MP'});
 assert.deepEqual(p.parseBrandModel(goods[3]),{brand:'EZVIZ',model:'Tipe tidak tercatat'});
 assert.deepEqual(p.parseBrandModel(goods[5]),{brand:'Merek tidak teridentifikasi',model:'Tipe tidak tercatat'});
 assert.deepEqual(p.parseBrandModel(goods[6]),{brand:'Merek tidak teridentifikasi',model:'Tipe tidak tercatat'});
 assert.deepEqual(p.parseBrandModel(goods[7]),{brand:'Dahua',model:'DH-XVR1B04-I/T'});
 assert.equal(p.parseBrandModel(r('Penjualan CCTV Ezviz H8C 2MP','CCTV',100,30)).brand,'Merek tidak teridentifikasi');
 assert.equal(Object.keys(p.REPORTS).length,11);
 const totals=p.brandModels(goods,'brand');
 assert.equal(totals.rows.reduce((a,b)=>a+b.Transaksi,0),goods.length);
 assert.notEqual(totals.rows[0].Merek,'Merek tidak teridentifikasi');
 assert.equal(totals.rows.find(x=>x.Merek==='EZVIZ').Transaksi,4);
 assert.equal(totals.rows.find(x=>x.Merek==='Merek tidak teridentifikasi').Transaksi,2);
 assert(totals.brandOptions.includes('EZVIZ')&&totals.brandOptions.includes('Hikvision'));
 const models=p.brandModels(goods,'brand-model');
 assert.equal(models.rows.find(x=>x.Merek==='EZVIZ'&&x['Tipe/Model / Deskripsi']==='H8C 2MP').Transaksi,2);
 assert.equal(models.rows.find(x=>x.Merek==='EZVIZ'&&x['Tipe/Model / Deskripsi']==='Tipe tidak tercatat').Transaksi,1);
 assert.equal(models.rows.filter(x=>x.Merek==='Merek tidak teridentifikasi').length,1);
 assert.equal(models.rows.reduce((a,b)=>a+b.Transaksi,0),goods.length);
 const filtered=p.brandModels(goods,'brand-model','EZVIZ');
 assert.equal(filtered.summary.transactions,4);
 assert(filtered.rows.every(x=>x.Merek==='EZVIZ'));
 assert.equal(filtered.brandOptions.length,totals.brandOptions.length);
 assert.throws(()=>p.brandModels(goods,'brand','A Brand Not There'),{status:400});
 const deps={readRows:async()=>goods,listOutlets:async()=>[]};
 for(const code of ['prod-brand-best','prod-brand-model']){
  const d=await p.getData({},code,{brand:'EZVIZ'},deps);assert.equal(d.source,'Accounting');assert(d.readOnly);assert.equal(d.summary.transactions,4);
  assert(d.columns.includes('Merek'));assert(d.note.includes('bukan SKU'));
 }
 for(const code of ['prod-category-revenue','prod-item-best'])assert((await p.getData({},code,{},deps)).rows.length>0);
 const html=fs.readFileSync('public/report-center.html','utf8');
 assert(html.includes('id="brand-model-filter"'));
 assert(html.includes('groupButton.setAttribute'));
 assert(html.includes("p.set('brand',$('brand-model').value)"));
 for(const tag of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(tag[1]);
 console.log('PASS PXL-RPT-0007D: brand/model parsing, standalone brand, ambiguous project, normalized model groups, filter, summary, legacy reports, UI syntax');
})().catch(e=>{console.error(e);process.exitCode=1});
