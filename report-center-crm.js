'use strict';
// PXL-RPT-0008 — CRM classification reporting (read-only).
// Customer source belongs to SO; only match by exact customer_id, not names.
const REPORTS=Object.freeze({
 'crm-classification':{title:'CRM — Detail Klasifikasi Customer',kind:'detail'},
 'crm-segments':{title:'CRM — Rekap Market Segment & Sector',kind:'segment'},
 'crm-sources':{title:'CRM — Rekap Sumber Customer (SO Terhubung)',kind:'source'},
 'crm-top-shoppers':{title:'CRM — Top Customer Belanja Semua Segmen',kind:'shopping'},
 'crm-top-shoppers-b2b':{title:'CRM — Top Customer Belanja B2B',kind:'shopping',segment:'B2B'},
 'crm-top-shoppers-b2c':{title:'CRM — Top Customer Belanja B2C',kind:'shopping',segment:'B2C'}
});
const cols=['Customer','Sales PIC','Market Segment','Sector','Sumber Customer (SO)','Jumlah SO Terhubung','Tanggal Dibuat'];
const clean=v=>String(v??'').trim();
const day=v=>clean(v).slice(0,10);
const safe=v=>clean(v)||'Belum Tercatat';
const MAX_ROWS=5000;
function report(customers,orders,kind,options={}){
 if(options.from&&options.to&&options.from>options.to)throw Object.assign(new Error('Tanggal tidak valid'),{status:400});
 const validCustomers=(customers||[]).filter(c=>!options.from&&!options.to||((!options.from||day(c.created_at)>=options.from)&&(!options.to||day(c.created_at)<=options.to)));
 const linked=new Map();
 for(const so of orders||[]){
  if(so.is_deleted===true||!clean(so.customer_id))continue;
  const id=clean(so.customer_id),items=linked.get(id)||[];items.push(so);linked.set(id,items);
 }
 const data=[];
 for(const c of validCustomers){
  const pic=safe(c.sales_pic),segment=safe(c.market_segment),sector=safe(c.sector);
  const related=linked.get(clean(c.id))||[];
  // Never infer CRM acquisition from unrelated SO or from matching names.
  const sources=[...new Set(related.map(x=>clean(x.customer_source)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  const source=sources.length?sources.join(' / '):'Belum Tercatat';
  if(options.pic&&options.pic!==pic)continue;
  if(options.market_segment&&options.market_segment!==segment)continue;
  if(options.sector&&options.sector!==sector)continue;
  if(options.customer_source&&options.customer_source!==source&&!sources.includes(options.customer_source))continue;
  data.push({customer:safe(c.name),pic,segment,sector,sources,source,orders:related.length,created:day(c.created_at)});
 }
 const optionsList={
  pic:[...new Set(validCustomers.map(c=>safe(c.sales_pic)))].sort(),
  market_segment:[...new Set(validCustomers.map(c=>safe(c.market_segment)))].sort(),
  sector:[...new Set(validCustomers.map(c=>safe(c.sector)))].sort(),
  customer_source:[...new Set(data.flatMap(c=>c.sources.length?c.sources:['Belum Tercatat']))].sort()
 };
 // Source options must remain available after user changes a source filter.
 const allSources=[...new Set(validCustomers.flatMap(c=>(linked.get(clean(c.id))||[]).map(x=>clean(x.customer_source)).filter(Boolean)))].sort();
 if(validCustomers.some(c=>!(linked.get(clean(c.id))||[]).some(x=>clean(x.customer_source))))allSources.push('Belum Tercatat');
 optionsList.customer_source=allSources;
 let rows,columns,note;
 if(kind==='detail'){
  columns=cols;
  rows=data.map(x=>({'Customer':x.customer,'Sales PIC':x.pic,'Market Segment':x.segment,'Sector':x.sector,
   'Sumber Customer (SO)':x.source,'Jumlah SO Terhubung':x.orders,'Tanggal Dibuat':x.created}));
  note='Sumber CRM untuk PIC/segment/sector; Sumber Customer dari SO yang memiliki customer_id identik. Beberapa sumber ditampilkan terpisah dengan /, bukan ditebak sebagai sumber akuisisi pertama.';
 }else if(kind==='segment'){
  const agg=new Map();
  for(const x of data){const key=JSON.stringify([x.segment,x.sector]);agg.set(key,(agg.get(key)||0)+1);}
  columns=['Market Segment','Sector','Jumlah Customer'];
  rows=[...agg.entries()].map(([key,n])=>{const [seg,sector]=JSON.parse(key);return {'Market Segment':seg,'Sector':sector,'Jumlah Customer':n};}).sort((a,b)=>b['Jumlah Customer']-a['Jumlah Customer']);
  note='Jumlah customer CRM berdasarkan Market Segment dan Sector pada master CRM. Customer tanpa klasifikasi tetap ditampilkan.';
 }else{
  const agg=new Map();
  for(const x of data){
   const sources=x.sources.length?x.sources:['Belum Tercatat'];
   // One customer can count in multiple sources if SO history differs.
   for(const source of sources)agg.set(source,(agg.get(source)||0)+1);
  }
  columns=['Sumber Customer (SO)','Customer Unik Terhubung'];
  rows=[...agg.entries()].map(([name,n])=>({'Sumber Customer (SO)':name,'Customer Unik Terhubung':n})).sort((a,b)=>b['Customer Unik Terhubung']-a['Customer Unik Terhubung']);
  note='Sumber berdasarkan SO yang terhubung tepat via customer_id. Satu customer bisa berada pada lebih dari satu sumber jika memiliki beberapa SO; jumlah per sumber tidak selalu dapat dijumlahkan sebagai customer unik global.';
 }
 const missing=data.filter(x=>!x.sources.length).length;
 return {columns,rows:rows.slice(0,MAX_ROWS),summary:{items:data.length},totalSource:rows.length,limit:MAX_ROWS,filters:optionsList,note:note+' '+missing+' customer tanpa sumber SO tercatat.'};
}
const accounting=require('./report-center-accounting');
const nameKey=v=>clean(v).replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
const numeric=v=>Number.isFinite(Number(v))?Number(v):0;
const rounded=v=>Number(v.toFixed(2));
function customerShopping(customers,transactions,options={},fixedSegment=''){
 const byName=new Map();
 for(const c of customers||[]){
  const key=nameKey(c.name);if(!key)continue;
  const arr=byName.get(key)||[];arr.push(c);byName.set(key,arr);
 }
 const groups=new Map();let unmatched=0,ambiguous=0,filtered=0;
 for(const tx of transactions||[]){
  const matches=byName.get(nameKey(tx.customer_name))||[];
  if(matches.length===0){unmatched++;continue;}
  if(matches.length!==1){ambiguous++;continue;}
  const crm=matches[0],segment=safe(crm.market_segment),pic=safe(crm.sales_pic),sector=safe(crm.sector);
  if(fixedSegment&&segment!==fixedSegment)continue;
  if(options.market_segment&&segment!==options.market_segment)continue;
  if(options.pic&&pic!==options.pic)continue;
  if(options.sector&&sector!==options.sector)continue;
  const key=clean(crm.id),item=groups.get(key)||{crm,segment,pic,sector,count:0,omzet:0,hpp:0,net:0};
  item.count++;item.omzet+=numeric(tx.gross_amount);item.hpp+=numeric(tx.hpp_amount);item.net+=numeric(tx.net_amount);
  groups.set(key,item);filtered++;
 }
 const rows=[...groups.values()].sort((a,b)=>b.omzet-a.omzet||b.count-a.count).map((v,i)=>({
  'Peringkat':i+1,'Customer':safe(v.crm.name),'Market Segment':v.segment,'Sector':v.sector,'Sales PIC':v.pic,
  'Transaksi':v.count,'Omzet (Rp)':rounded(v.omzet),'HPP (Rp)':rounded(v.hpp),'NET (Rp)':rounded(v.net)
 }));
 const totals=rows.reduce((a,x)=>({transactions:a.transactions+x.Transaksi,omzet:a.omzet+x['Omzet (Rp)'],hpp:a.hpp+x['HPP (Rp)'],net:a.net+x['NET (Rp)']}),{transactions:0,omzet:0,hpp:0,net:0});
 for(const k of ['omzet','hpp','net'])totals[k]=rounded(totals[k]);
 const filters={
  pic:[...new Set((customers||[]).map(c=>safe(c.sales_pic)))].sort(),
  market_segment:[...new Set((customers||[]).map(c=>safe(c.market_segment)))].sort(),
  sector:[...new Set((customers||[]).map(c=>safe(c.sector)))].sort(),
  customer_source:[]
 };
 return {columns:['Peringkat','Customer','Market Segment','Sector','Sales PIC','Transaksi','Omzet (Rp)','HPP (Rp)','NET (Rp)'],
  rows:rows.slice(0,MAX_ROWS),summary:totals,filters,totalSource:rows.length,limit:MAX_ROWS,
  note:'Omzet/HPP/NET dari transaksi Accounting, segmen dan PIC dari CRM. Customer dihubungkan hanya jika nama ter-normalisasi cocok tepat dan unik di CRM; bukan relasi ID langsung. '+unmatched+' transaksi Accounting tidak cocok dan '+ambiguous+' ambigu, sehingga dikecualikan dari peringkat. Jumlah transaksi bukan unit barang terjual.',
  matchedTransactions:filtered,unmatchedTransactions:unmatched,ambiguousTransactions:ambiguous};
}
async function getData(db,code,options={},deps={}){
 const spec=Object.hasOwn(REPORTS,code)?REPORTS[code]:null;
 if(!spec)throw Object.assign(new Error('Laporan CRM tidak tersedia'),{status:404});
 if(spec.kind==='shopping'){
  const [customers,transactions]=await Promise.all([(deps.customers||db.getCrmCustomers)(),(deps.accountingRows||accounting.readRows)({from:options.from,to:options.to})]);
  const result=customerShopping(customers,transactions,options,spec.segment||'');
  return {...result,code,title:spec.title,source:'CRM + Accounting',readOnly:true};
 }
 const [customers,orders]=await Promise.all([(deps.customers||db.getCrmCustomers)(),(deps.orders||db.getSalesOrders)()]);
 const result=report(customers,orders,spec.kind,options);
 return {...result,code,title:spec.title,source:'CRM',readOnly:true};
}
module.exports={REPORTS,report,customerShopping,getData};
