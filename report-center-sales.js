'use strict';
// PXL-RPT-0004 — Accounting-backed sales performance, read-only.
// No conversion-rate claims without verifiable CRM-lead-to-Accounting linkage.
const accounting=require('./report-center-accounting');
const LABELS=accounting.LABELS;
const REPORTS=Object.freeze({
 'sales-pic':{title:'Sales — Performance per PIC (Accounting)',kind:'pic'},
 'sales-segment':{title:'Sales — Kontribusi per Segmen',kind:'segment'},
 'sales-outlet':{title:'Sales — Kontribusi per Outlet',kind:'outlet'},
 'sales-pic-segment':{title:'Sales — PIC × Segmen',kind:'pic-segment'},
 'sales-customer':{title:'Sales — Customer Terbesar (Accounting)',kind:'customer'},
 'sales-repeat':{title:'Sales — Customer Berulang (Transaksi)',kind:'repeat'}
});
const note='Sumber: Accounting. Nominal menggunakan Omzet/HPP/NET transaksi, bukan SO. Customer berulang dihitung berdasarkan kesamaan nama customer yang dinormalisasi dalam periode pilihan; ini bukan conversion rate lead→transaksi. PIC yang tidak tercatat ditampilkan terpisah.';
const baseColumns=['Transaksi','Omzet (Rp)','HPP (Rp)','NET (Rp)','Rata-rata Omzet (Rp)','Kontribusi Omzet (%)'];
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const m=v=>Number(v.toFixed(2));
const norm=v=>String(v||'').trim().replace(/\s+/g,' ');
const pic=r=>norm(r.pic_name)||'PIC Belum Diisi';
const customer=r=>norm(r.customer_name)||'Customer Belum Diisi';
const customerKey=r=>customer(r).toLocaleLowerCase('id-ID');
function totals(rows){
 const out=accounting.totals(rows);
 return {...out,avg:rows.length?m(out.omzet/rows.length):0};
}
function build(rows,kind,outlets){
 const byId=new Map((outlets||[]).map(o=>[String(o.id),String(o.name)]));
 const validCustomer=new Map();
 for(const r of rows){const key=customerKey(r);if(key!=='customer belum diisi')validCustomer.set(key,(validCustomer.get(key)||0)+1);}
 const groups=new Map();
 const overall=totals(rows);
 for(const r of rows){
  let keys;
  if(kind==='pic')keys=[pic(r)];
  else if(kind==='segment')keys=[LABELS[r.classification]||r.classification||'Belum Diklasifikasi'];
  else if(kind==='outlet')keys=[byId.get(String(r.outlet_id))||'Outlet Tidak Dikenal'];
  else if(kind==='pic-segment')keys=[pic(r),LABELS[r.classification]||r.classification||'Belum Diklasifikasi'];
  else keys=[customerKey(r)];
  if(kind==='repeat'&&(customer(r)==='Customer Belum Diisi'||validCustomer.get(keys[0])<2))continue;
  const id=JSON.stringify(keys);
  if(!groups.has(id))groups.set(id,{keys,records:[],display:kind==='customer'||kind==='repeat'?customer(r):keys[0]});
  groups.get(id).records.push(r);
 }
 const extra=kind==='pic-segment'?['Sales PIC','Segmen']:kind==='customer'||kind==='repeat'?['Customer']:kind==='pic'?['Sales PIC']:kind==='segment'?['Segmen']:['Outlet'];
 const result=[...groups.values()].map(g=>{
  const t=totals(g.records),label={};
  if(kind==='pic-segment'){label['Sales PIC']=g.keys[0];label.Segmen=g.keys[1];}
  else label[extra[0]]=g.display;
  return {...label,'Transaksi':t.transactions,'Omzet (Rp)':t.omzet,'HPP (Rp)':t.hpp,'NET (Rp)':t.net,'Rata-rata Omzet (Rp)':t.avg,'Kontribusi Omzet (%)':overall.omzet?m(t.omzet/overall.omzet*100):0};
 }).sort((a,b)=>b['Omzet (Rp)']-a['Omzet (Rp)']||b.Transaksi-a.Transaksi);
 const repeating= [...validCustomer.values()].filter(count=>count>1).length;
 return {columns:[...extra,...baseColumns],rows:result,summary:overall,repeatCustomers:repeating};
}
async function getData(code,options={},deps={}){
 const spec=Object.hasOwn(REPORTS,code)?REPORTS[code]:null;
 if(!spec)throw Object.assign(new Error('Laporan sales tidak tersedia'),{status:404});
 const check=accounting.validate(options);
 const load=deps.readRows||accounting.readRows,getOutlets=deps.listOutlets||require('./accounting-sales-store').listOutlets;
 const [rows,outlets]=await Promise.all([load({...options,...check}),getOutlets()]);
 const data=build(rows,spec.kind,outlets);
 return {...data,code,title:spec.title,source:'Accounting',readOnly:true,note,totalSource:rows.length,limit:20000};
}
module.exports={REPORTS,build,getData,note};
