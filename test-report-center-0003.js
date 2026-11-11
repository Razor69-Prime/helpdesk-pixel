'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('./report-center-products');
const a='f093ba8d-dd95-4b7b-86fa-2669c966df4d',b='4ab666aa-c5b5-4696-928c-3728e3bb8052';
const rows=[
 {sales_type:'BARANG',classification:'B2C',outlet_id:a,product_category:'CCTV',gross_amount:100,hpp_amount:60,dpp_amount:90,ppn_amount:10,net_amount:30},
 {sales_type:'BARANG',classification:'B2B',outlet_id:a,product_category:'CCTV',gross_amount:400,hpp_amount:220,dpp_amount:360,ppn_amount:40,net_amount:140},
 {sales_type:'BARANG',classification:'B2BG',outlet_id:b,product_category:'Kabel',gross_amount:300,hpp_amount:200,dpp_amount:270,ppn_amount:30,net_amount:70},
 {sales_type:'JASA',classification:'B2C',outlet_id:b,product_category:'CCTV',gross_amount:9900,hpp_amount:9000,dpp_amount:9000,ppn_amount:900,net_amount:0},
 {sales_type:'BARANG',classification:'B2C',outlet_id:b,product_category:'',gross_amount:50,hpp_amount:20,dpp_amount:45,ppn_amount:5,net_amount:25}
];
const mock={readRows:async()=>rows,listOutlets:async()=>[{id:a,name:'Buduk'},{id:b,name:'Lukluk'}]};
(async()=>{
 assert.equal(Object.keys(R.REPORTS).length,12);
 assert(Object.keys(R.REPORTS).every(x=>x.startsWith('prod-category-')||x.startsWith('prod-item-')||x.startsWith('prod-brand-')));
 const top=await R.getData({},'prod-category-revenue',{},mock);
 assert.equal(top.source,'Accounting');assert(top.readOnly);assert.equal(top.summary.transactions,4);assert.equal(top.summary.omzet,850);
 assert.equal(top.rows[0]['Kategori Produk'],'CCTV');assert.equal(top.rows[0]['Omzet (Rp)'],500);
 assert.equal(top.rows[0]['Transaksi'],2);
 const active=await R.getData({},'prod-category-active',{},mock);assert.equal(active.rows[0]['Kategori Produk'],'CCTV');
 const slow=await R.getData({},'prod-category-low',{},mock);assert.equal(slow.rows.at(-1)['Kategori Produk'],'CCTV');
 const net=await R.getData({},'prod-category-net',{},mock);assert.equal(net.rows[0]['Kategori Produk'],'CCTV');
 const outlet=await R.getData({},'prod-category-outlet',{outlet_id:a},mock);assert(outlet.columns.includes('Outlet'));assert(outlet.rows.some(x=>x.Outlet==='Buduk'));
 const segment=await R.getData({},'prod-category-segment',{},mock);assert(segment.columns.includes('Klasifikasi'));
 await assert.rejects(R.getData({},'prod-fast',{},mock),{status:404});
 const source=fs.readFileSync('report-center-products.js','utf8');
 assert(!/getInventoryItems|getSalesOrders|inventory_transactions|readMovements/.test(source));
 assert(/accounting\.readRows/.test(source));
 assert(/Sumber tunggal: Accounting/.test(source));
 const html=fs.readFileSync('public/report-center.html','utf8');for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 assert(html.includes("chosen.startsWith('prod-')"));
 console.log('PASS PXL-RPT-0003A: accounting-only category reports, service exclusion, filters, no fake SKU/moving, guard and UI');
})().catch(e=>{console.error(e);process.exitCode=1});
