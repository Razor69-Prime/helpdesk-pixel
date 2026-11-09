'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('./report-center-accounting');
const id='123e4567-e89b-42d3-a456-426614174000';
const sample=[
 {transaction_date:'2026-11-01',classification:'B2B',outlet_id:id,gross_amount:111,hpp_amount:55,dpp_amount:100,ppn_amount:11,net_amount:45,customer_name:'One'},
 {transaction_date:'2026-11-02',classification:'B2BG',outlet_id:id,gross_amount:222,hpp_amount:100,dpp_amount:200,ppn_amount:22,net_amount:100,customer_name:'Two'},
 {transaction_date:'2026-11-02',classification:'B2C',outlet_id:id,gross_amount:333,hpp_amount:200,dpp_amount:300,ppn_amount:33,net_amount:100,customer_name:'Three'},
 {transaction_date:'2026-11-03',classification:'B2G',outlet_id:id,gross_amount:444,hpp_amount:300,dpp_amount:400,ppn_amount:44,net_amount:100,customer_name:'Four'}
];
(async()=>{
 for(const s of ['B2C','B2B','B2G','B2BG'])assert(A.LABELS[s]);
 assert.throws(()=>A.validate({classification:'INVALID'}),{status:400});
 assert.throws(()=>A.validate({outlet_id:'oops'}),{status:400});
 const seen=[];
 const fakeFetch=async(url,opts)=>{const u=new URL(url);seen.push({u,opts});assert.equal(opts.method,'GET');const cl=u.searchParams.get('classification');return{ok:true,json:async()=>sample.filter(r=>!cl||cl==='eq.'+r.classification)};};
 const rows=await A.readRows({from:'2026-11-01',to:'2026-11-30',classification:'B2C'},{fetch:fakeFetch,config:{POSTGREST_URL:'http://localhost:3000',POSTGREST_KEY:'test'}});
 assert.equal(rows.length,1);assert.equal(seen.length,1);assert.equal(seen[0].u.searchParams.get('limit'),'800');assert.equal(seen[0].u.searchParams.get('classification'),'eq.B2C');assert.match(seen[0].u.searchParams.get('and'),/transaction_date.lte.2026-11-30/);
 const deps={listOutlets:async()=>[{id,name:'Buduk'}],readRows:async f=>sample.filter(r=>!f.classification||r.classification===f.classification)};
 const main=await A.getData('acc-summary',{},deps);
 assert.equal(main.rows.length,4);assert.equal(main.summary.omzet,1110);assert.equal(main.summary.hpp,655);assert.equal(main.summary.net,345);
 const b2b=await A.getData('acc-b2b',{},deps);assert.equal(b2b.rows.length,1);assert.equal(b2b.rows[0].Klasifikasi,'B2B Corp');
 assert(!JSON.stringify(b2b).includes('password'));
 const byOutlet=await A.getData('acc-outlets',{},deps);assert.equal(byOutlet.rows.length,1);assert.equal(byOutlet.rows[0].Kelompok,'Buduk');
 const s=fs.readFileSync('public/report-center.html','utf8');new vm.Script([...s.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);
 assert.match(s,/accounting-outlet/);assert.match(s,/accounting-segment/);assert.match(s,/renderSummary/);
 const api=fs.readFileSync('report-center-api.js','utf8');assert.match(api,/superadminOnly/);assert.match(api,/accounting\/outlets/);
 console.log('PASS PXL-RPT-0002: segment, money, outlet, GET-only, filters, UI & role guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
