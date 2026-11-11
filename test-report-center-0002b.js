'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const api=require('./report-center-accounting');
const rows=[
 {transaction_date:'2026-01-05',classification:'B2C',gross_amount:100,hpp_amount:50,dpp_amount:90,ppn_amount:10,net_amount:40},
 {transaction_date:'2026-01-07',classification:'B2B',gross_amount:100,hpp_amount:60,dpp_amount:90,ppn_amount:10,net_amount:30},
 {transaction_date:'2026-02-01',classification:'B2BG',gross_amount:300,hpp_amount:200,dpp_amount:270,ppn_amount:30,net_amount:70},
 {transaction_date:'2026-04-01',classification:'B2G',gross_amount:600,hpp_amount:400,dpp_amount:540,ppn_amount:60,net_amount:140}
];
(async()=>{
 const result=api.monthlyRows(rows,'2026-01-01','2026-12-31');
 assert.equal(result.length,12);
 assert.equal(result[0]['Omzet (Rp)'],200);
 assert.equal(result[1]['Omzet (Rp)'],300);
 assert.equal(result[1]['Perubahan Omzet'],'50.0%');
 assert.equal(result[2]['Omzet (Rp)'],0);
 assert.equal(result[2]['Perubahan Omzet'],'-100.0%');
 assert.equal(result[3]['Perubahan Omzet'],'Baru');
 assert.equal(result[11]['Transaksi'],0);
 assert.equal(api.monthlyRows(rows,'2025-12-01','2026-01-31').length,2);
 assert.throws(()=>api.monthlyRows(rows,'2020-01-01','2026-12-31'),{status:400});
 const deps={listOutlets:async()=>[],readRows:async()=>rows};
 const data=await api.getData('acc-monthly',{from:'2026-01-01',to:'2026-12-31'},deps);
 assert.equal(data.rows.length,12);
 assert.equal(data.summary.omzet,1100);
 assert.equal(data.columns.at(-1),'Perubahan Omzet');
 const html=fs.readFileSync('public/report-center.html','utf8');
 const js=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
 new vm.Script(js);
 for(const id of ['period-this','period-last','period-compare'])assert(html.includes('id="'+id+'"'));
 assert(js.includes("timeZone:'Asia/Makassar'"));
 assert(js.includes("today.year+'-01-01'"));
 assert(js.includes("selectReport('acc-monthly')"));
 const nav=fs.readFileSync('public/report-center-nav.js','utf8');
 assert(nav.includes('report-center.html?v=PXL-RPT-0008'));
 console.log('PASS PXL-RPT-0002B: monthly buckets, MoM, leap/year boundary, WITA actions, UI');
})().catch(e=>{console.error(e);process.exitCode=1});
