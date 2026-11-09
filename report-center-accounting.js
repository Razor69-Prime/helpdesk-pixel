'use strict';
// PXL-RPT-0002 — GET-only Accounting reports. Never mutate Accounting tables.
const {CLASSIFICATIONS}=require('./accounting-sales-v1');
const LABELS={B2B:'B2B Corp',B2BG:'B2B Grosir',B2C:'B2C',B2G:'B2G'};
const REPORTS=Object.freeze({
 'acc-summary':{title:'Accounting — Ringkasan Klasifikasi',kind:'segment'},
 'acc-monthly':{title:'Accounting — Perbandingan per Bulan',kind:'monthly'},
 'acc-b2b':{title:'Accounting — B2B Corp',segment:'B2B',kind:'details'},
 'acc-b2bg':{title:'Accounting — B2B Grosir',segment:'B2BG',kind:'details'},
 'acc-b2c':{title:'Accounting — B2C',segment:'B2C',kind:'details'},
 'acc-b2g':{title:'Accounting — B2G',segment:'B2G',kind:'details'},
 'acc-outlets':{title:'Accounting — Perbandingan Outlet',kind:'outlets'},
 'acc-transactions':{title:'Accounting — Detail Transaksi',kind:'details'}
});
const MAX_TRANSACTIONS=20000,PAGE=800;
const number=v=>Number.isFinite(Number(v))?Number(v):0;
const amount=n=>Number(n.toFixed(2));
function validate(filters={}){
 const outlet=String(filters.outlet_id||'').trim(),classification=String(filters.classification||'').trim().toUpperCase();
 if(outlet&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(outlet))throw Object.assign(new Error('Outlet tidak valid'),{status:400});
 if(classification&&!CLASSIFICATIONS.includes(classification))throw Object.assign(new Error('Klasifikasi tidak valid'),{status:400});
 return {outlet_id:outlet,classification};
}
async function readRows(filters={},deps={}){
 const fetcher=deps.fetch||global.fetch, cfg=deps.config||require('./config');
 if(!cfg.POSTGREST_URL||!cfg.POSTGREST_KEY)throw new Error('Sumber Accounting tidak dikonfigurasi');
 const cols='transaction_date,classification,sub_classification,outlet_id,customer_name,job_name,transaction_description,product_category,pic_name,paid_status,sales_type,gross_amount,hpp_amount,dpp_amount,ppn_amount,net_amount';
 const result=[];
 for(let offset=0;offset<=MAX_TRANSACTIONS;offset+=PAGE){
  const p=new URLSearchParams({select:cols,deleted_at:'is.null',order:'transaction_date.desc,created_at.desc',limit:String(PAGE),offset:String(offset)});
  if(filters.from)p.set('transaction_date','gte.'+filters.from);
  if(filters.to){
   p.delete('transaction_date');
   if(filters.from)p.set('and',`(transaction_date.gte.${filters.from},transaction_date.lte.${filters.to})`);
   else p.set('transaction_date','lte.'+filters.to);
  }
  if(filters.outlet_id)p.set('outlet_id','eq.'+filters.outlet_id);
  if(filters.classification)p.set('classification','eq.'+filters.classification);
  const base=String(cfg.POSTGREST_URL);const url=(base.endsWith('/')?base.slice(0,-1):base)+'/rest/v1/accounting_sales_transactions?'+p;
  const response=await fetcher(url,{method:'GET',headers:{apikey:cfg.POSTGREST_KEY,Authorization:'Bearer '+cfg.POSTGREST_KEY,Accept:'application/json'}});
  if(!response.ok)throw new Error('Sumber Accounting tidak dapat dibaca: HTTP '+response.status);
  const page=await response.json();
  if(!Array.isArray(page))throw new Error('Format data Accounting tidak valid');
  result.push(...page);
  if(result.length>MAX_TRANSACTIONS)throw Object.assign(new Error('Data terlalu banyak; pilih periode yang lebih pendek (maksimum '+MAX_TRANSACTIONS+' transaksi)'),{status:422});
  if(page.length<PAGE)break;
 }
 return result;
}
function totals(rows){
 const out={transactions:rows.length,omzet:0,hpp:0,dpp:0,ppn:0,net:0};
 for(const r of rows){out.omzet+=number(r.gross_amount);out.hpp+=number(r.hpp_amount);out.dpp+=number(r.dpp_amount);out.ppn+=number(r.ppn_amount);out.net+=number(r.net_amount);}
 for(const k of ['omzet','hpp','dpp','ppn','net'])out[k]=amount(out[k]);
 return out;
}
const finColumns=['Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)'];
function financialRow(name,s){return {'Kelompok':name,'Transaksi':s.transactions,'Omzet (Rp)':s.omzet,'HPP (Rp)':s.hpp,'DPP (Rp)':s.dpp,'PPN (Rp)':s.ppn,'NET (Rp)':s.net};}
function monthlyRows(rows,from,to){
 const current=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const localYear=Number(current.find(p=>p.type==='year').value);
 const first=from?from.slice(0,7):String(localYear)+'-01';
 const last=to?to.slice(0,7):String(localYear)+'-12';
 const output=[];
 let year=Number(first.slice(0,4)),month=Number(first.slice(5,7));
 const endYear=Number(last.slice(0,4)),endMonth=Number(last.slice(5,7));
 if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12||!Number.isInteger(endYear)||!Number.isInteger(endMonth)||endMonth<1||endMonth>12||year*12+month>endYear*12+endMonth||endYear*12+endMonth-(year*12+month)>35)throw Object.assign(new Error('Perbandingan maksimal 36 bulan'),{status:400});
 const buckets=new Map();
 for(const r of rows){const key=String(r.transaction_date||'').slice(0,7);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
 while(year*12+month<=endYear*12+endMonth){
  const key=year+'-'+String(month).padStart(2,'0');
  const name=new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)));
  const total=totals(buckets.get(key)||[]);
  const previous=output.length?output[output.length-1]['Omzet (Rp)']:null;
  const change=previous===null?'—':previous===0?(total.omzet===0?'0%':'Baru'):(100*(total.omzet-previous)/previous).toFixed(1)+'%';
  output.push({...financialRow(name,total),'Perubahan Omzet':change});
  month++;if(month===13){month=1;year++;}
 }
 return output;
}
const detailColumns=['Tanggal','Outlet','Klasifikasi','Customer','Pekerjaan','Transaksi','Kategori Produk','PIC','Status Paid','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)'];
function detailRow(r,outletNames){return {'Tanggal':r.transaction_date||'','Outlet':outletNames.get(r.outlet_id)||r.outlet_id||'','Klasifikasi':LABELS[r.classification]||r.classification||'','Customer':r.customer_name||'','Pekerjaan':r.job_name||'','Transaksi':r.transaction_description||'','Kategori Produk':r.product_category||'','PIC':r.pic_name||'','Status Paid':r.paid_status||'','Omzet (Rp)':number(r.gross_amount),'HPP (Rp)':number(r.hpp_amount),'DPP (Rp)':number(r.dpp_amount),'PPN (Rp)':number(r.ppn_amount),'NET (Rp)':number(r.net_amount)};}
async function getData(code,options={},deps={}){
 if(!Object.hasOwn(REPORTS,code))throw Object.assign(new Error('Laporan tidak dikenal'),{status:404});
 const spec=REPORTS[code],v=validate(options),classification=spec.segment||v.classification;
 const loadOutlets=deps.listOutlets||require('./accounting-sales-store').listOutlets,loadRows=deps.readRows||readRows;
 const [outlets,allRows]=await Promise.all([loadOutlets(),loadRows({...options,...v,classification})]);
 const outletNames=new Map((outlets||[]).map(o=>[o.id,o.name]));
 const summary=totals(allRows);
 let columns,rows;
 if(spec.kind==='monthly'){
  columns=['Kelompok',...finColumns,'Perubahan Omzet'];rows=monthlyRows(allRows,options.from,options.to);
 }else if(spec.kind==='segment'){
  columns=['Kelompok',...finColumns];
  rows=CLASSIFICATIONS.filter(x=>!classification||classification===x).map(x=>financialRow(LABELS[x],totals(allRows.filter(r=>r.classification===x))));
 }else if(spec.kind==='outlets'){
  columns=['Kelompok',...finColumns];
  rows=(outlets||[]).filter(o=>!v.outlet_id||o.id===v.outlet_id).map(o=>financialRow(o.name,totals(allRows.filter(r=>r.outlet_id===o.id))));
  const known=new Set((outlets||[]).map(o=>o.id));
  if(allRows.some(r=>!known.has(r.outlet_id)))rows.push(financialRow('Outlet tidak aktif/tidak dikenal',totals(allRows.filter(r=>!known.has(r.outlet_id)))));
 }else{columns=detailColumns;rows=allRows.map(r=>detailRow(r,outletNames));}
 return {code,title:spec.title,columns,rows,totalSource:allRows.length,limit:MAX_TRANSACTIONS,summary,source:'Accounting',readOnly:true};
}
module.exports={REPORTS,LABELS,validate,readRows,totals,monthlyRows,getData};
