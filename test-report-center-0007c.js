'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const p=require('./report-center-products');
const item=(name,cat,omzet,net,hpp=0,unit='BARANG')=>({transaction_description:name,product_category:cat,gross_amount:omzet,net_amount:net,hpp_amount:hpp,dpp_amount:omzet*.9,ppn_amount:omzet*.1,sales_type:unit});
const all=[
 item(' Ezviz  H8C  2MP ','CCTV',100,40),item('ezviz h8c 2mp','CCTV',200,80),
 item('EZVIZ H8C 4MP','CCTV',160,90),item('Hikvision NVR','NVR',300,15),
 item('Ezviz H8C 2MP','Lainnya',50,10),item('','CCTV',20,8),
 item('Teknisi Instalasi','JASA',900,400,0,'JASA')
];
(async()=>{
 assert.equal(Object.keys(p.REPORTS).length,11);
 const a=p.itemBestSellers(all.filter(x=>x.sales_type==='BARANG'),'revenue');
 assert.equal(a.rows.length,4);assert.equal(a.rows[0]['Omzet (Rp)'],300);
 const h=a.rows.find(x=>x['Kategori Produk']==='CCTV'&&x['Nama Barang / Deskripsi Transaksi'].toLowerCase().includes('h8c 2mp'));
 assert(h);assert.equal(h.Transaksi,2);assert.equal(h['Omzet (Rp)'],300);
 assert.equal(a.missingDescriptions,1);assert.match(a.note,/bukan SKU/);assert.match(a.note,/beberapa item/);
 assert.equal(a.summary.transactions,6);assert.equal(a.summary.omzet,830);
 const freq=p.itemBestSellers(all.filter(x=>x.sales_type==='BARANG'),'frequency');
 assert.equal(freq.rows[0].Transaksi,2);
 const net=p.itemBestSellers(all.filter(x=>x.sales_type==='BARANG'),'net');
 assert.equal(net.rows[0]['Omzet (Rp)'],300);
 const deps={readRows:async()=>all,listOutlets:async()=>[]};
 for(const code of ['prod-item-best','prod-item-active','prod-item-net']){
  const r=await p.getData({},code,{},deps);
  assert(r.readOnly);assert.equal(r.source,'Accounting');assert.equal(r.summary.transactions,6);
  assert(r.columns.includes('Nama Barang / Deskripsi Transaksi'));
  assert(!r.rows.some(x=>String(x['Nama Barang / Deskripsi Transaksi']).includes('Teknisi Instalasi')));
 }
 for(const code of ['prod-category-revenue','prod-category-net','prod-category-active','prod-category-low','prod-category-outlet','prod-category-segment']){
  const r=await p.getData({},code,{},deps);assert(r.rows.length>0);
 }
 const raw=fs.readFileSync('report-center-products.js','utf8');
 assert(!/getInventoryItems|getSalesOrders|inventory_transactions/.test(raw));
 const html=fs.readFileSync('public/report-center.html','utf8');
 for(const tag of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(tag[1]);
 console.log('PASS PXL-RPT-0007C: item revenue, frequency, net, normalize, category isolation, missing descriptions, Accounting only, existing reports');
})().catch(e=>{console.error(e);process.exitCode=1});
