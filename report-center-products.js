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
 'prod-item-net':{title:'Item Best Seller — Kontribusi NET',kind:'item',sort:'net'},
 'prod-brand-best':{title:'Brand Best Seller — Omzet Accounting',kind:'brand'},
 'prod-brand-model':{title:'Brand & Tipe/Model Best Seller',kind:'brand-model'}
});
const fmt=v=>Number.isFinite(Number(v))?Number(v):0;
const money=v=>Number(v.toFixed(2));
const rowColumns=['Kategori Produk','Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)','Kontribusi Omzet (%)'];
const outletColumns=['Outlet',...rowColumns];
const segmentColumns=['Klasifikasi',...rowColumns];
const itemColumns=['Nama Barang / Deskripsi Transaksi','Kategori Produk','Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)','Kontribusi Omzet (%)'];
const BRAND_NAMES=Object.freeze(['Hikvision','EZVIZ','Dahua','IMOU','Beans','Jaify','HiView','Hiksemi','Uniview','TP-Link','Tenda','Ruijie','MikroTik','Seagate','Western Digital','Lenovo','HP','ASUS','Acer','Cisco','Ubiquiti','Sandisk']);
const UNKNOWN_BRAND='Merek tidak teridentifikasi',UNKNOWN_MODEL='Tipe tidak tercatat';
const BRAND_COLUMNS=['Merek','Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)','Kontribusi Omzet (%)'];
const MODEL_COLUMNS=['Merek','Tipe/Model / Deskripsi','Kategori Produk','Transaksi','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)','Kontribusi Omzet (%)'];
const BRAND_NOTE='Sumber hanya Accounting transaksi BARANG. Merek dikenali hanya dari awalan deskripsi transaksi. Tipe/model adalah bagian teks yang tercatat setelah merek, bukan SKU terverifikasi. Deskripsi merek saja ditandai Tipe tidak tercatat; proyek/paket tanpa awalan merek tidak dianggap satu produk. Transaksi bukan jumlah unit terjual.';
function parseBrandModel(row){
 const text=itemName(row);
 if(!text||/^other brand(?:\s|$)/i.test(text))return {brand:UNKNOWN_BRAND,model:UNKNOWN_MODEL};
 for(const brand of BRAND_NAMES){
  const prefix=new RegExp('^'+brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|$)','i');
  const match=text.match(prefix);
  if(match){
   const suffix=text.slice(match[0].length).trim().replace(/\s+/g,' ');
   return {brand,model:suffix||UNKNOWN_MODEL};
  }
 }
 return {brand:UNKNOWN_BRAND,model:UNKNOWN_MODEL};
}
function brandModels(goods,kind,brandFilter=''){
 const parsed=goods.map(row=>({row,...parseBrandModel(row)}));
 const options=BRAND_NAMES.filter(brand=>parsed.some(x=>x.brand===brand));
 if(parsed.some(x=>x.brand===UNKNOWN_BRAND))options.push(UNKNOWN_BRAND);
 if(brandFilter&&!options.includes(brandFilter))throw Object.assign(new Error('Filter merek tidak valid'),{status:400});
 const selected=parsed.filter(x=>!brandFilter||x.brand===brandFilter);
 const total=summarize(selected.map(x=>x.row));
 const groups=new Map(),byBrand=new Map();
 for(const x of selected){
  const key=kind==='brand'?JSON.stringify([x.brand]):JSON.stringify([x.brand,x.model.toLocaleLowerCase('id-ID'),categoryName(x.row).toLocaleLowerCase('id-ID')]);
  if(!groups.has(key))groups.set(key,{brand:x.brand,model:x.model,category:categoryName(x.row),records:[]});
  groups.get(key).records.push(x.row);
  const prior=byBrand.get(x.brand)||0;byBrand.set(x.brand,prior+fmt(x.row.gross_amount));
 }
 const rows=[...groups.values()].map(g=>{
  const sum=summarize(g.records);
  const row={'Merek':g.brand,'Transaksi':sum.transactions,'Omzet (Rp)':sum.omzet,'HPP (Rp)':sum.hpp,
   'DPP (Rp)':sum.dpp,'PPN (Rp)':sum.ppn,'NET (Rp)':sum.net,
   'Kontribusi Omzet (%)':total.omzet?Number((sum.omzet/total.omzet*100).toFixed(2)):0};
  if(kind==='brand-model'){row['Tipe/Model / Deskripsi']=g.model;row['Kategori Produk']=g.category;}
  return row;
 });
 rows.sort((a,b)=>{
  if(a.Merek===UNKNOWN_BRAND&&b.Merek!==UNKNOWN_BRAND)return 1;
  if(b.Merek===UNKNOWN_BRAND&&a.Merek!==UNKNOWN_BRAND)return -1;
  if(kind==='brand-model'){
   const diff=(byBrand.get(b.Merek)||0)-(byBrand.get(a.Merek)||0);
   if(diff)return diff;
   if(a.Merek!==b.Merek)return a.Merek.localeCompare(b.Merek,'id');
  }
  return b['Omzet (Rp)']-a['Omzet (Rp)']||b.Transaksi-a.Transaksi||a.Merek.localeCompare(b.Merek,'id');
 });
 const unclassified=selected.filter(x=>x.brand===UNKNOWN_BRAND).length;
 const noModel=selected.filter(x=>x.model===UNKNOWN_MODEL).length;
 return {columns:kind==='brand'?BRAND_COLUMNS:MODEL_COLUMNS,rows,summary:total,brandOptions:options,
  note:BRAND_NOTE+' '+unclassified+' transaksi tanpa merek teridentifikasi; '+noModel+' transaksi tanpa tipe/model teridentifikasi.'};
}
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
 const result=spec.kind==='brand'||spec.kind==='brand-model'?brandModels(goods,spec.kind,String(options.brand||'').trim()):spec.kind==='item'?itemBestSellers(goods,spec.sort):aggregate(goods,spec.kind,spec.sort,outlets);
 return {...result,code,title:spec.title,source:'Accounting',readOnly:true,note:result.note||note,limit:20000,totalSource:goods.length};
}
module.exports={REPORTS,summarize,aggregate,itemBestSellers,parseBrandModel,brandModels,getData,note};
