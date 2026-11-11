'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const mod=require('./report-center-crm');
const customers=[
{id:'a',name:'Dr Wilson',sales_pic:'Eka',market_segment:'B2C',sector:'End User',created_at:'2026-11-03'},
{id:'b',name:'Kantor A',sales_pic:'Reya',market_segment:'B2B',sector:'Pemerintahan',created_at:'2026-11-05'},
{id:'c',name:'Guest',sales_pic:'',market_segment:'Unclassified',sector:null,created_at:'2026-10-01'}
];
const orders=[
 {id:'s1',customer_id:'a',customer_source:'Referral'},
 {id:'s2',customer_id:'a',customer_source:'Organic'},
 {id:'s3',customer_id:'b',customer_source:''},
 {id:'s4',customer_id:'unknown',customer_name:'Dr Wilson',customer_source:'Meta Ads'},
 {id:'s5',customer_id:'b',customer_source:'Meta Ads',is_deleted:true}
];
(async()=>{
 const detail=mod.report(customers,orders,'detail');
 assert.equal(detail.rows.length,3);
 assert(detail.rows[0]['Sumber Customer (SO)'].includes('Organic'));
 assert(detail.rows[0]['Sumber Customer (SO)'].includes('Referral'));
 assert.equal(detail.rows[0]['Jumlah SO Terhubung'],2);
 assert.equal(detail.rows[1]['Sumber Customer (SO)'],'Belum Tercatat');
 assert.equal(detail.rows[2]['Sumber Customer (SO)'],'Belum Tercatat');
 assert(!detail.filters.customer_source.includes('Meta Ads'));
 assert.equal(detail.summary.items,3);
 const b2c=mod.report(customers,orders,'detail',{market_segment:'B2C'});
 assert.equal(b2c.rows.length,1);
 const byPic=mod.report(customers,orders,'detail',{pic:'Reya'});
 assert.equal(byPic.rows.length,1);
 const sourceFiltered=mod.report(customers,orders,'detail',{customer_source:'Referral'});
 assert.equal(sourceFiltered.rows.length,1);
 const period=mod.report(customers,orders,'detail',{from:'2026-11-01',to:'2026-11-30'});
 assert.equal(period.rows.length,2);
 const segments=mod.report(customers,orders,'segment');
 assert.equal(segments.rows.reduce((n,r)=>n+r['Jumlah Customer'],0),3);
 const sources=mod.report(customers,orders,'source');
 const byName=Object.fromEntries(sources.rows.map(x=>[x['Sumber Customer (SO)'],x['Customer Unik Terhubung']]));
 assert.deepEqual(byName,{'Organic':1,'Referral':1,'Belum Tercatat':2});
 assert.equal(sources.summary.items,3);
 const opts={customers:async()=>customers,orders:async()=>orders};
 for(const code of Object.keys(mod.REPORTS)){
  const result=await mod.getData({},code,{},opts);assert(result.readOnly);assert.equal(result.source,'CRM');
 }
 await assert.rejects(mod.getData({},'crm-invalid',{},opts),{status:404});
 const ui=fs.readFileSync('public/report-center.html','utf8');
 assert(ui.includes('id="menu-toggle"'));assert(ui.includes('aria-expanded="true"'));
 assert(ui.includes('menu-collapsed'));assert(ui.includes('refreshCatalog'));
 assert(ui.includes('crm-market_segment-filter'));assert(ui.includes('crm-customer_source-filter'));
 for(const m of ui.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 const api=fs.readFileSync('report-center-api.js','utf8');
 assert(api.includes("group:'CRM & Customer Classification'"));assert(api.includes('superadminOnly'));
 console.log('PASS PXL-RPT-0008: CRM PIC/segment/sector, exact SO source join, multi-source, date and source filters, menu collapse and category expand, role');
})().catch(e=>{console.error(e);process.exitCode=1});
