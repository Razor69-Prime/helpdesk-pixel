'use strict';
// PXL-RPT-0003A — Accounting-only product/category reports (read-only).
// No Inventory/SO access. Accounting has product_category, but no verified per-SKU quantity.
// Fast/slow here means transaction activity per CATEGORY, never physical stock movement.
const accounting=require('./report-center-accounting');
const REPORTS=Object.freeze({
 'prod-category-revenue':{title:'Produk — Kategori Terlaris (Omzet Accounting)',kind:'category',sort:'revenue'},
 'prod-category-net':{title:'Produk — Kategori Kontribusi NET Terbesar',kind:'category',sort:'net'},
 'prod-category-active':{title:'Produk — Kategori Paling Aktif (Jumlah Transaksi)',kind:'category',sort:'frequency'},
 'prod-category-low':{title:'Produk — Kategori Paling Sedikit Transaksi',kind:'category',sort:'low'},
 'prod-category-outlet':{title:'Produk — Kategori per Outlet (Accounting)',kind:'outlet'},
 'prod-category-segment':{title:'Produk — Kategori per Segmen (Accounting)',kind:'segment'},
 'prod-item-best':{title:'Item Best Seller — Omzet (Accounting)',kind:'item',sort:'revenue'},
 'prod-item-active':{title:'Item Best Seller — Frekuensi Transaksi',kind:'item',sort:'frequency'},
 'prod-item-net':{title:'Item Best Seller — Kontribusi NET',kind:'item',sort:'net'}
});
const fmt=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>Number(v.toFixed(2));
const rowColumns=['Kategori Produk','Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)','Kontribusi Omzet (%)'];
const outletColumns=['Outlet',...rowColumns];
const segmentColumns=['Klasifikasi',...rowColumns];
const itemColumns=['Nama Barang / Deskripsi Transaksi','Kategori Produk','Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)','Kontribusi Omzet (%)'];
const itemNote='Sumber tunggal: Accounting (sales_type BARANG), dikelompokkan menurut deskripsi transaksi, bukan SKU terverifikasi. Peringkat omzet/NET/frekuensi berdasarkan transaksi; tidak menunjukkan jumlah unit atau stok. Jika satu deskripsi mencakup beberapa item, nominalnya tidak dipecah per item.';
function itemName(row){return String(row.transaction_description||'').replace(/\s+/g,' ').trim();}
function itemBestSellers(goods,sort){
 const total=summarize(goods),groups=new Map(),missing=goods.filter(r=>!itemName(r)).length;
 for(const row of goods){
  const label=itemName(row);
  if(!label)continue;
  const cat=categoryName(row);
  // Include category to avoid silently merging same description across categories.
  const key=JSON.stringify([label.toLocaleLowerCase('id-ID'),cat.toLocaleLowerCase('id-ID')]);
  if(!groups.has(key))groups.set(key,{name:label,category:cat,records:[]});
  groups.get(key).records.push(row);
 }
 const rows=[...groups.values()].map(g=>{
  const sum=summarize(g.records);
  return {'Nama Barang / Deskripsi Transaksi':g.name,'Kategori Produk':g.category,
   'Transaksi':sum.transactions,'Omzet (Rp)':sum.omzet,'HPP (Rp)':sum.hpp,
   'DPP (Rp)':sum.dpp,'PPN (Rp)':sum.ppn,'NET (Rp)':sum.net,
   'Kontribusi Omzet (%)':total.omzet?Number((sum.omzet/total.omzet*100).toFixed(2)):0};
 });
 const compare=(a,b)=>{
  if(sort==='frequency')return b.Transaksi-a.Transaksi||b['Omzet (Rp)']-a['Omzet (Rp)'];
  if(sort==='net')return b['NET (Rp)']-a['NET (Rp)']||b['Omzet (Rp)']-a['Omzet (Rp)'];
  return b['Omzet (Rp)']-a['Omzet (Rp)']||b.Transaksi-a.Transaksi;
 };
 rows.sort((a,b)=>compare(a,b)||a['Nama Barang / Deskripsi Transaksi'].localeCompare(b['Nama Barang / Deskripsi Transaksi'],'id'));
 return {columns:itemColumns,rows,summary:total,missingDescriptions:missing,
  note:itemNote+(missing?' '+missing+' transaksi tanpa deskripsi tidak masuk peringkat.':'')};
}

const note='Sumber tunggal: Accounting, transaksi sales_type BARANG. Peringkat berdasarkan kategori produk; bukan SKU, quantity unit, atau pergerakan stok. Transaksi jasa dikecualikan.';
function summarize(rows){
 const result={transactions:rows.length,omzet:0,hpp:0,dpp:0,ppn:0,net:0};
 for(const r of rows){result.omzet+=fmt(r.gross_amount);result.hpp+=fmt(r.hpp_amount);result.dpp+=fmt(r.dpp_amount);result.ppn+=fmt(r.ppn_amount);result.net+=fmt(r.net_amount);}
 for(const field of ['omzet','hpp','dpp','ppn','net'])result[field]=money(result[field]);
 return result;
}
function categoryName(row){return String(row.product_category||'').trim()||'Belum Dikategorikan';}
function aggregate(rows,kind,sort,outlets){
 const outletNames=new Map((outlets||[]).map(o=>[String(o.id),String(o.name)]));
 const total=summarize(rows),groups=new Map();
 for(const r of rows){
  const category=categoryName(r);
  const outlet=outletNames.get(String(r.outlet_id))||'Outlet tidak dikenal';
  const segment=accounting.LABELS[r.classification]||r.classification||'Tidak Diklasifikasikan';
  const first=kind==='outlet'?outlet:kind==='segment'?segment:null;
  const key=JSON.stringify([first,category]);
  if(!groups.has(key))groups.set(key,{first,category,rows:[]});
  groups.get(key).rows.push(r);
 }
 const formatted=[...groups.values()].map(g=>{
  const sum=summarize(g.rows);
  const x={'Kategori Produk':g.category,'Transaksi':sum.transactions,'Omzet (Rp)':sum.omzet,'HPP (Rp)':sum.hpp,'DPP (Rp)':sum.dpp,'PPN (Rp)':sum.ppn,'NET (Rp)':sum.net,'Kontribusi Omzet (%)':total.omzet?Number((sum.omzet/total.omzet*100).toFixed(2)):0};
  if(kind==='outlet')x.Outlet=g.first;
  if(kind==='segment')x.Klasifikasi=g.first;
  return x;
 });
 const comparator=(a,b)=>{
  if(sort==='low')return a.Transaksi-b.Transaksi||a['Omzet (Rp)']-b['Omzet (Rp)'];
  if(sort==='frequency')return b.Transaksi-a.Transaksi||b['Omzet (Rp)']-a['Omzet (Rp)'];
  if(sort==='net')return b['NET (Rp)']-a['NET (Rp)'];
  return b['Omzet (Rp)']-a['Omzet (Rp)'];
 };
 formatted.sort((a,b)=>comparator(a,b)||String(a['Kategori Produk']).localeCompare(String(b['Kategori Produk']),'id'));
 return {columns:kind==='outlet'?outletColumns:kind==='segment'?segmentColumns:rowColumns,rows:formatted,summary:total};
}
async function getData(_db,code,options={},deps={}){
 const spec=Object.hasOwn(REPORTS,code)?REPORTS[code]:null;
 if(!spec)throw Object.assign(new Error('Laporan tidak tersedia; pilih laporan kategori Accounting'),{status:404});
 const check=accounting.validate(options);
 const read=deps.readRows||accounting.readRows;
 const getOutlets=deps.listOutlets||require('./accounting-sales-store').listOutlets;
 const [allRows,outlets]=await Promise.all([read({...options,...check}),getOutlets()]);
 const goods=allRows.filter(r=>String(r.sales_type||'').trim().toUpperCase()==='BARANG');
 const result=spec.kind==='item'?itemBestSellers(goods,spec.sort):aggregate(goods,spec.kind,spec.sort,outlets);
 return {...result,code,title:spec.title,source:'Accounting',readOnly:true,note:result.note||note,limit:20000,totalSource:goods.length};
}
module.exports={REPORTS,summarize,aggregate,itemBestSellers,getData,note};
