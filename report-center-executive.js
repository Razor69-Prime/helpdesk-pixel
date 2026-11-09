'use strict';
// PXL-RPT-0006 — Executive Summary. GET-only, Superadmin protection is enforced by report-center-api.
const accounting=require('./report-center-accounting');
const REPORTS=Object.freeze({'exec-summary':{title:'Executive Summary — Dashboard Manajemen'}});
const number=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>Number(v.toFixed(2));
const CLOSED=new Set(['done','cancelled','canceled','void']);
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
function currentMonth(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit'}).formatToParts(now);
 const y=parts.find(p=>p.type==='year').value,m=parts.find(p=>p.type==='month').value;
 return {from:y+'-'+m+'-01',to:y+'-'+m+'-'+String(new Date(Date.UTC(Number(y),Number(m),0)).getUTCDate()).padStart(2,'0')};
}
function period(options={}){
 const fallback=currentMonth(),from=options.from||fallback.from,to=options.to||fallback.to;
 if(!validDate(from)||!validDate(to)||from>to)throw Object.assign(new Error('Periode laporan tidak valid'),{status:400});
 return {from,to};
}
function date(v){return String(v||'').slice(0,10);}
function inRange(value,from,to){const d=date(value);return d&&d>=from&&d<=to;}
function build(rows,tickets,projects,range){
 const tx=rows.filter(x=>inRange(x.transaction_date,range.from,range.to));
 const finance=accounting.totals(tx),noPic=tx.filter(x=>!String(x.pic_name||'').trim()).length;
 const order=new Map();
 for(const x of tx){const k=String(x.pic_name||'').trim()||'PIC Belum Diisi';order.set(k,(order.get(k)||0)+number(x.gross_amount));}
 const top=[...order.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
 const woCreated=tickets.filter(t=>inRange(t.created_at,range.from,range.to));
 const woDone=woCreated.filter(t=>String(t.status||'').toLowerCase()==='done').length;
 const activeWO=tickets.filter(t=>!CLOSED.has(String(t.status||'').toLowerCase())).length;
 const openProject=projects.filter(p=>!['done','completed','cancelled'].includes(String(p.status||'').toLowerCase())).length;
 const holdProject=projects.filter(p=>String(p.status||'').toLowerCase()==='hold').length;
 const doneProject=projects.filter(p=>String(p.status||'').toLowerCase()==='done').length;
 const pct=woCreated.length?money(woDone/woCreated.length*100):0;
 const values=[
  ['Omzet Accounting',finance.omzet,'Rp','Accounting: transaksi pada periode'],
  ['HPP Accounting',finance.hpp,'Rp','Accounting: transaksi pada periode'],
  ['NET Accounting',finance.net,'Rp','Accounting: transaksi pada periode'],
  ['Jumlah Transaksi',finance.transactions,'Transaksi','Accounting: transaksi pada periode'],
  ['Transaksi tanpa PIC',noPic,'Transaksi','Kelengkapan data Accounting pada periode'],
  ['WO Dibuat',woCreated.length,'WO','WO dibuat pada periode'],
  ['WO Selesai dari WO Dibuat',woDone,'WO','Status sekarang pada WO yang dibuat dalam periode'],
  ['Rasio WO Selesai',pct,'%','WO selesai / WO dibuat pada periode; bukan SLA'],
  ['WO Masih Aktif',activeWO,'WO','Snapshot seluruh WO termasuk arsip; bukan hanya periode'],
  ['Project Belum Selesai',openProject,'Project','Snapshot status Project Tracker; bukan hanya periode'],
  ['Project Hold',holdProject,'Project','Snapshot status Project Tracker; bukan hanya periode'],
  ['Project Done',doneProject,'Project','Snapshot status Project Tracker; bukan hanya periode']
 ];
 for(let i=0;i<top.length;i++)values.push(['Sales PIC Top '+(i+1)+': '+top[i][0],money(top[i][1]),'Rp','Peringkat omzet Accounting pada periode']);
 const metrics=values.map(([metric,value,unit,basis])=>({'Indikator':metric,'Nilai':value,'Satuan':unit,'Dasar Data':basis}));
 return {columns:['Indikator','Nilai','Satuan','Dasar Data'],rows:metrics,summary:{dashboard:true,omzet:finance.omzet,hpp:finance.hpp,net:finance.net,transactions:finance.transactions,activeWO,projectsOpen:openProject},note:'Sumber: Accounting, Work Order, Project Tracker (read-only). Nilai Accounting berbasis periode, sedangkan WO aktif dan status Project adalah snapshot saat laporan dibuka. Tidak menyimpulkan konversi CRM, utilisasi jam teknisi, atau progress BOQ.'};
}
async function getData(db,code,options={},deps={}){
 if(!Object.hasOwn(REPORTS,code))throw Object.assign(new Error('Laporan tidak tersedia'),{status:404});
 const range=period(options);
 const [rows,tickets,projects]=await Promise.all([
  (deps.readRows||accounting.readRows)(range),
  (deps.getTickets||(()=>db.getTickets(null,true)))(),
  (deps.getProjects||db.getProjects)()
 ]);
 const result=build(rows,tickets,projects,range);
 return {...result,code,title:REPORTS[code].title,source:'Executive',readOnly:true,period:range,totalSource:result.rows.length,limit:100};
}
module.exports={REPORTS,currentMonth,period,build,getData};
