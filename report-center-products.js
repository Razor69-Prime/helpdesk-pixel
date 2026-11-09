'use strict';
// PXL-RPT-0003: Reporting only. Approved SO = ordered items, NOT confirmed sales.
// Inventory REQUEST = stock issued, NOT necessarily sold. OPNAME/MERGE excluded.
const REPORTS=Object.freeze({
 'prod-so-qty':{title:'Produk — Terbanyak di SO Disetujui (Qty)',kind:'so',sort:'qty'},
 'prod-so-value':{title:'Produk — Nilai Tertinggi di SO Disetujui',kind:'so',sort:'value'},
 'prod-fast':{title:'Inventory — Fast Moving (Pengeluaran Stok)',kind:'movement',sort:'fast'},
 'prod-slow':{title:'Inventory — Slow Moving (Pengeluaran Stok)',kind:'movement',sort:'slow'},
 'prod-dead':{title:'Inventory — Tidak Bergerak (Stok > 0)',kind:'movement',sort:'dead'},
 'prod-low-stock':{title:'Inventory — Stok Minimum/Kritis',kind:'stock'}
});
const PAGE=750,LIMIT=20000;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const norm=v=>String(v||'').trim().toLowerCase();
function witaDay(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d))}
function bounds(options={},days=90){
 const now=new Date(),to=options.to||witaDay(now),from=options.from||witaDay(new Date(now.getTime()-days*86400000));
 if(from>to)throw Object.assign(new Error('Rentang tanggal tidak valid'),{status:400});
 return {from,to};
}
function inPeriod(raw,from,to){if(!raw)return false;const s=String(raw);const day=s.length>10&&/T/.test(s)?witaDay(s):s.slice(0,10);return day>=from&&day<=to;}
function productIndex(items){
 const byId=new Map(),sku=new Map();
 for(const item of items){byId.set(String(item.id),item);if(norm(item.sku)){const key=norm(item.sku);if(!sku.has(key))sku.set(key,item);else sku.set(key,null);}}
 return {byId,sku};
}
const columns=['SKU','Nama Barang','Kategori','Satuan','Qty','Nilai (Rp)','Stok Saat Ini','Referensi'];
const movColumns=['SKU','Nama Barang','Kategori','Satuan','Qty Keluar','Frekuensi Keluar','Stok Saat Ini','Status'];
const stockColumns=['SKU','Nama Barang','Kategori','Satuan','Stok Saat Ini','Stok Minimum','Status'];
function salesOrders(orders,items,from,to,sort){
 const {byId,sku}=productIndex(items),agg=new Map();let missing=0;
 for(const so of orders){
  if(norm(so.status)!=='approved'||so.is_deleted===true||!inPeriod(so.approved_at||so.created_at,from,to))continue;
  for(const line of (Array.isArray(so.items)?so.items:[])){
   if(norm(line.item_type)==='jasa'||norm(line.item_type)==='service')continue;
   const item=byId.get(String(line.inventory_item_id||''))||sku.get(norm(line.sku));
   if(!item){missing++;continue;}
   const qty=num(line.qty);if(qty<=0)continue;
   const key=String(item.id),prev=agg.get(key)||{item,qty:0,value:0,orders:new Set()};
   prev.qty+=qty;prev.value+=num(line.line_total)||qty*num(line.unit_price);
   prev.orders.add(so.id);agg.set(key,prev);
  }
 }
 const result=[...agg.values()].sort((a,b)=>sort==='value'?b.value-a.value||b.qty-a.qty:b.qty-a.qty||b.value-a.value).map(x=>({
 'SKU':x.item.sku||'','Nama Barang':x.item.name||'','Kategori':x.item.category||'','Satuan':x.item.unit||'',
 'Qty':Number(x.qty.toFixed(2)),'Nilai (Rp)':Number(x.value.toFixed(2)),
 'Stok Saat Ini':num(x.item.stock),'Referensi':x.orders.size+' SO disetujui'
 }));
 return {columns,rows:result,summary:{items:result.length,qty:Number(result.reduce((a,r)=>a+r.Qty,0).toFixed(2)),value:Number(result.reduce((a,r)=>a+r['Nilai (Rp)'],0).toFixed(2))},note:'Berdasarkan item Inventory dalam Sales Order berstatus approved; bukan konfirmasi barang telah terjual. '+missing+' baris SO tidak memiliki pasangan SKU/Inventory dan dikecualikan.'};
}
async function readMovements(options={},deps={}){
 const fetcher=deps.fetch||global.fetch,cfg=deps.config||require('./config'),{from,to}=bounds(options);
 if(!cfg.POSTGREST_URL||!cfg.POSTGREST_KEY)throw new Error('Koneksi Inventory belum dikonfigurasi');
 const all=[];
 const base=String(cfg.POSTGREST_URL).replace(/\/$/,'');
 for(let offset=0;offset<=LIMIT;offset+=PAGE){
  const q=new URLSearchParams({select:'item_id,transaction_type,qty,created_at',transaction_type:'eq.REQUEST',order:'created_at.desc',limit:String(PAGE),offset:String(offset)});
  // Read by server-side time range with 1-day buffer for WITA conversion.
  const lower=new Date(Date.parse(from+'T00:00:00Z')-86400000).toISOString();
  q.set('created_at','gte.'+lower);
  const url=base+'/rest/v1/inventory_transactions?'+q;
  const resp=await fetcher(url,{method:'GET',headers:{apikey:cfg.POSTGREST_KEY,Authorization:'Bearer '+cfg.POSTGREST_KEY,Accept:'application/json'}});
  if(!resp.ok)throw new Error('Gagal membaca histori Inventory: HTTP '+resp.status);
  const page=await resp.json();if(!Array.isArray(page))throw new Error('Histori Inventory tidak valid');
  all.push(...page);
  if(all.length>LIMIT)throw Object.assign(new Error('Histori terlalu besar. Persempit rentang tanggal.'),{status:422});
  if(page.length<PAGE)break;
 }
 return all.filter(x=>num(x.qty)<0&&inPeriod(x.created_at,from,to));
}
function moving(items,transactions,sort){
 const agg=new Map();
 for(const t of transactions){if(String(t.transaction_type).toUpperCase()!=='REQUEST'||num(t.qty)>=0)continue;const key=String(t.item_id),v=agg.get(key)||{qty:0,n:0};v.qty+=Math.abs(num(t.qty));v.n++;agg.set(key,v);}
 let rows=items.filter(i=>i.is_active!==false).map(i=>{const a=agg.get(String(i.id))||{qty:0,n:0};return {'SKU':i.sku||'','Nama Barang':i.name||'','Kategori':i.category||'','Satuan':i.unit||'','Qty Keluar':Number(a.qty.toFixed(2)),'Frekuensi Keluar':a.n,'Stok Saat Ini':num(i.stock),'Status':a.qty===0?'Tidak Ada Pengeluaran':'Ada Pengeluaran'};});
 if(sort==='dead')rows=rows.filter(r=>r['Stok Saat Ini']>0&&r['Qty Keluar']===0).sort((a,b)=>b['Stok Saat Ini']-a['Stok Saat Ini']);
 else if(sort==='slow')rows=rows.filter(r=>r['Stok Saat Ini']>0&&r['Qty Keluar']>0).sort((a,b)=>a['Qty Keluar']-b['Qty Keluar']);
 else rows=rows.filter(r=>r['Qty Keluar']>0).sort((a,b)=>b['Qty Keluar']-a['Qty Keluar']);
 return {columns:movColumns,rows,summary:{items:rows.length,qty:Number(rows.reduce((a,r)=>a+r['Qty Keluar'],0).toFixed(2))},note:'Mutasi stok REQUEST saja; tidak sama dengan penjualan. OPNAME, MERGE, dan RESTOCK dikecualikan. Slow = item berstok dengan pengeluaran paling rendah selama periode; tidak bergerak = tidak ada REQUEST selama periode.'};
}
function lowStock(items){
 const rows=items.filter(i=>i.is_active!==false&&num(i.min_stock)>0&&num(i.stock)<=num(i.min_stock)).map(i=>({
 'SKU':i.sku||'','Nama Barang':i.name||'','Kategori':i.category||'','Satuan':i.unit||'','Stok Saat Ini':num(i.stock),'Stok Minimum':num(i.min_stock),'Status':num(i.stock)===0?'Habis':'Kritis'
 })).sort((a,b)=>a['Stok Saat Ini']-b['Stok Saat Ini']);
 return {columns:stockColumns,rows,summary:{items:rows.length},note:'Berdasarkan stok saat ini dan batas minimum yang sudah diatur pada Inventory; hanya item yang memiliki stok minimum > 0.'};
}
async function getData(db,code,options={},deps={}){
 const spec=REPORTS[code];if(!spec)throw Object.assign(new Error('Laporan produk tidak dikenal'),{status:404});
 const items=await (deps.getInventoryItems||db.getInventoryItems)();
 const dates=bounds(options);
 let result;
 if(spec.kind==='stock')result=lowStock(items);
 else if(spec.kind==='so'){
  const orders=await (deps.getSalesOrders||db.getSalesOrders)();
  result=salesOrders(orders,items,dates.from,dates.to,spec.sort);
 }else result=moving(items,await (deps.readMovements||readMovements)(dates),spec.sort);
 return {...result,code,title:spec.title,source:spec.kind==='so'?'Sales Order':spec.kind==='stock'?'Inventory':'Inventory REQUEST',period:dates,readOnly:true,totalSource:result.rows.length,limit:LIMIT};
}
module.exports={REPORTS,getData,readMovements,salesOrders,moving,lowStock,bounds,witaDay};
