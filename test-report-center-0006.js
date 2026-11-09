'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('./report-center-executive');
const range={from:'2026-11-01',to:'2026-11-30'};
const rows=[
 {transaction_date:'2026-11-01',gross_amount:111,hpp_amount:70,dpp_amount:100,ppn_amount:11,net_amount:30,pic_name:'A'},
 {transaction_date:'2026-11-05',gross_amount:222,hpp_amount:150,dpp_amount:200,ppn_amount:22,net_amount:50,pic_name:''},
 {transaction_date:'2026-10-05',gross_amount:500,hpp_amount:350,dpp_amount:450,ppn_amount:50,net_amount:100,pic_name:'A'}
];
const tickets=[
 {created_at:'2026-11-02',status:'done'}, {created_at:'2026-11-02',status:'ongoing'},
 {created_at:'2026-10-01',status:'assigned'}, {created_at:'2026-10-01',status:'cancelled'}
];
const projects=[{status:'On Plan'},{status:'Hold'},{status:'Done'}];
(async()=>{
 const r=R.build(rows,tickets,projects,range),map=new Map(r.rows.map(x=>[x.Indikator,x.Nilai]));
 assert.equal(map.get('Omzet Accounting'),333);
 assert.equal(map.get('HPP Accounting'),220);
 assert.equal(map.get('NET Accounting'),80);
 assert.equal(map.get('Jumlah Transaksi'),2);
 assert.equal(map.get('Transaksi tanpa PIC'),1);
 assert.equal(map.get('WO Dibuat'),2);
 assert.equal(map.get('WO Selesai dari WO Dibuat'),1);
 assert.equal(map.get('Rasio WO Selesai'),50);
 assert.equal(map.get('WO Masih Aktif'),2);
 assert.equal(map.get('Project Belum Selesai'),2);
 assert.equal(map.get('Project Hold'),1);
 assert.equal(map.get('Project Done'),1);
 assert.equal(r.summary.activeWO,2);
 assert.equal(R.currentMonth(new Date('2026-11-09T04:00:00Z')).from,'2026-11-01');
 assert.equal(R.currentMonth(new Date('2026-02-04T04:00:00Z')).to,'2026-02-28');
 assert.throws(()=>R.period({from:'2026-12-01',to:'2026-11-01'}),{status:400});
 const deps={readRows:async f=>{assert.deepEqual(f,range);return rows},getTickets:async()=>tickets,getProjects:async()=>projects};
 const result=await R.getData({},'exec-summary',range,deps);
 assert(result.readOnly);assert(result.note.includes('snapshot'));assert.equal(result.period.from,range.from);
 await assert.rejects(R.getData({},'exec-unknown',range,deps),{status:404});
 const api=fs.readFileSync('report-center-api.js','utf8'),html=fs.readFileSync('public/report-center.html','utf8');
 assert(api.includes('superadminOnly'));assert(api.includes("group:'Executive Summary'"));assert(html.includes('summary.dashboard'));
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 console.log('PASS PXL-RPT-0006: Accounting/WOs/projects metrics, WITA monthly default, role, UI, GET-only');
})().catch(e=>{console.error(e);process.exitCode=1});
