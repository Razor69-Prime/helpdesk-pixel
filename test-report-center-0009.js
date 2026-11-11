'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const m=require('./report-center-crm');
const customers=[
{id:'a',name:' Dr. Wilson ',sales_pic:'Eka',market_segment:'B2C',sector:'End User'},
{id:'b',name:'PT Maju',sales_pic:'Reya',market_segment:'B2B',sector:'Corporate'},
{id:'c',name:'PT Sama',sales_pic:'Reya',market_segment:'B2B',sector:'Swasta'},
{id:'d',name:'PT SAMA',sales_pic:'Eka',market_segment:'B2B',sector:'Swasta'}
];
const tx=[
{customer_name:'dr.  wilson',gross_amount:500,hpp_amount:200,net_amount:300},
{customer_name:'Dr. Wilson',gross_amount:250,hpp_amount:100,net_amount:150},
{customer_name:'PT Maju',gross_amount:900,hpp_amount:350,net_amount:550},
{customer_name:'PT Sama',gross_amount:9999,hpp_amount:2000,net_amount:7999},
{customer_name:'Tidak Ada',gross_amount:8000,hpp_amount:1000,net_amount:7000}
];
(async()=>{
 assert.equal(Object.keys(m.REPORTS).length,6);
 const all=m.customerShopping(customers,tx);
 assert.equal(all.rows.length,2);
 assert.equal(all.rows[0].Customer,'PT Maju');
 assert.equal(all.summary.transactions,3);assert.equal(all.summary.omzet,1650);
 assert.equal(all.unmatchedTransactions,1);assert.equal(all.ambiguousTransactions,1);
 assert.equal(all.rows.find(r=>r.Customer==='Dr. Wilson')['Transaksi'],2);
 assert.equal(m.customerShopping(customers,tx,{},'B2B').rows.length,1);
 assert.equal(m.customerShopping(customers,tx,{},'B2C').rows.length,1);
 assert.equal(m.customerShopping(customers,tx,{pic:'Eka'}).rows.length,1);
 assert.equal(m.customerShopping(customers,tx,{market_segment:'B2C'}).summary.omzet,750);
 const deps={customers:async()=>customers,accountingRows:async f=>{assert.equal(f.from,'2026-10-01');return tx}};
 for(const code of ['crm-top-shoppers','crm-top-shoppers-b2b','crm-top-shoppers-b2c']){
  const r=await m.getData({},code,{from:'2026-10-01',to:'2026-10-31'},deps);
  assert.equal(r.source,'CRM + Accounting');assert(r.readOnly);assert(r.columns.includes('Omzet (Rp)'));
  assert(r.filters.pic.includes('Eka'));
 }
 assert.equal((await m.getData({},'crm-top-shoppers-b2c',{from:'2026-10-01'},deps)).summary.omzet,750);
 const html=fs.readFileSync('public/report-center.html','utf8');
 assert(html.includes('id="compare-a"'));assert(html.includes('id="compare-b"'));
 assert(html.includes('function comparisonMetrics'));assert(html.includes('async function runMonthComparison'));
 assert(html.includes('function comparisonRows'));assert(html.includes('new URLSearchParams(common)'));
 const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];new vm.Script(source);
 const extract=(begin,end)=>source.slice(source.indexOf(begin),source.indexOf(end,source.indexOf(begin)));
 const comparators=extract('function monthDates(value){','let compareRequest=0;');
 const sandbox={Date,Number,String,Set,Map,JSON,Array,Intl,Error,console,make(){},$(){}};
 vm.createContext(sandbox);
 vm.runInContext(comparators+';globalThis.fn={monthDates,comparisonMetrics,comparisonRows}',sandbox);
 assert.equal(sandbox.fn.monthDates('2026-02').to,'2026-02-28');
 assert.equal(sandbox.fn.monthDates('2024-02').to,'2024-02-29');
 assert.throws(()=>sandbox.fn.monthDates('2026-13'));
 const a={columns:['Kelompok','Omzet (Rp)'],rows:[{Kelompok:'A','Omzet (Rp)':200},{Kelompok:'B','Omzet (Rp)':100}],summary:{omzet:300,transactions:2,activeWO:3}};
 const b={columns:['Kelompok','Omzet (Rp)'],rows:[{Kelompok:'A','Omzet (Rp)':280},{Kelompok:'C','Omzet (Rp)':100}],summary:{omzet:380,transactions:2,activeWO:4}};
 assert.equal(sandbox.fn.comparisonMetrics(a)['Omzet (Rp)'],300);
 assert(!('WO Aktif' in sandbox.fn.comparisonMetrics(a)));
 const detail=sandbox.fn.comparisonRows(a,b);
 assert.equal(detail.metric,'Omzet (Rp)');assert.equal(detail.rows.length,3);
 assert.equal(detail.rows.find(r=>r.name==='A').b,280);
 console.log('PASS PXL-RPT-0009: CRM best buyers all/B2B/B2C, ambiguous name excluded, exact matching, month dates/leap, shared comparison metrics and row alignment');
})().catch(e=>{console.error(e);process.exitCode=1;});
