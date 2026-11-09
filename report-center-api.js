'use strict';
// PXL-RPT-0001: isolated, read-only, superadmin-only reporting.
const accounting=require('./report-center-accounting');
const products=require('./report-center-products');
const salesReports=require('./report-center-sales');
const REPORTS=Object.freeze({
 wo:{title:'Work Order',source:'crm',key:'tickets',cols:[['wo_number','Nomor WO'],['customer_name','Customer'],['status','Status'],['technician','Teknisi'],['created_at','Dibuat'],['scheduled_date','Jadwal']]},
 sales:{title:'Sales Order',source:'crm',key:'sales_orders',cols:[['so_number','Nomor SO'],['customer_name','Customer'],['status','Status'],['total_amount','Total'],['created_at','Dibuat']]},
 visits:{title:'Kunjungan Sales',source:'crm',key:'visits',cols:[['visit_date','Tanggal'],['customer_name','Customer'],['sales_name','Sales'],['status','Status'],['notes','Catatan']]},
 projects:{title:'Project Tracker',source:'crm',key:'projects',cols:[['name','Project'],['customer_name','Customer'],['status','Status'],['progress','Progress'],['created_at','Dibuat']]},
 mr:{title:'Material Request',source:'mr',cols:[['mr_number','Nomor MR'],['project_name','Project'],['status','Status'],['created_at','Dibuat']]},
 pr:{title:'Purchase Request',source:'pr',cols:[['pr_number','Nomor PR'],['status','Status'],['requester_name','Requester'],['created_at','Dibuat']]},
 invoice:{title:'Invoice CRM',source:'crm',key:'invoices',cols:[['invoice_number','Nomor Invoice'],['customer_name','Customer'],['total_amount','Nominal'],['status','Status'],['created_at','Dibuat']]}
});
const MAX_ROWS=5000, DATE_KEYS=['created_at','visit_date','scheduled_date','updated_at','date','request_date'];
function superadminOnly(req,res,next){
 const role=String(req.session?.user?.role||'').trim().toLowerCase();
 if(role!=='superadmin')return res.status(req.session?.user?403:401).json({error:'Hanya Superadmin dapat mengakses Report Center'});
 next();
}
function dateParam(value){
 if(value==null||value==='')return null;
 const s=String(value);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Object.assign(new Error('Tanggal harus YYYY-MM-DD'),{status:400});
 return s;
}
function project(items,cols,from,to){
 if(!Array.isArray(items))return [];
 return items.filter(item=>{
  if(!from&&!to)return true;
  const key=DATE_KEYS.find(k=>typeof item?.[k]==='string'&&/^\d{4}-\d{2}-\d{2}/.test(item[k]));
  if(!key)return false;
  const day=item[key].slice(0,10);
  return (!from||day>=from)&&(!to||day<=to);
 }).slice(0,MAX_ROWS).map(item=>Object.fromEntries(cols.map(([key,label])=>{
  const value=item?.[key];return [label,typeof value==='number'||typeof value==='boolean'?value:typeof value==='string'?value.slice(0,700):''];
 })));
}
async function getData(db,code,from,to,options={}){
 if(Object.hasOwn(accounting.REPORTS,code))return accounting.getData(code,{...options,from,to});
 if(Object.hasOwn(products.REPORTS,code))return products.getData(db,code,{...options,from,to});
 if(Object.hasOwn(salesReports.REPORTS,code))return salesReports.getData(code,{...options,from,to});
 const spec=Object.hasOwn(REPORTS,code)?REPORTS[code]:null;
 if(!spec)throw Object.assign(new Error('Laporan tidak dikenal'),{status:404});
 let source;
 if(spec.source==='crm')source=(await db.getCrmReport())?.[spec.key];
 else if(spec.source==='mr')source=await db.getMRForms();
 else if(spec.source==='pr')source=await db.getPurchaseRequests();
 const rows=Array.isArray(source)?source:[];
 return {code,title:spec.title,columns:spec.cols.map(c=>c[1]),rows:project(rows,spec.cols,from,to),totalSource:rows.length,limit:MAX_ROWS};
}
function install(app,{db,requireAuth,reportSvc}){
 if(!app||!db||!requireAuth||!reportSvc)throw new Error('Report Center dependencies missing');
 const guards=[requireAuth,superadminOnly];
 const dates=req=>{const from=dateParam(req.query.from),to=dateParam(req.query.to);if(from&&to&&from>to)throw Object.assign(new Error('Rentang tanggal tidak valid'),{status:400});return {from,to};};
 const fail=(res,e)=>{if(!res.headersSent)res.status(e.status||500).json({error:e.status?e.message:'Gagal membaca laporan'});};
 app.get('/api/report-center/catalog',...guards,(_req,res)=>{res.set('Cache-Control','no-store');res.json({revision:'PXL-RPT-0004',readOnly:true,access:'superadmin',reports:[...Object.entries(REPORTS).map(([code,s])=>({code,title:s.title,group:'Operasional'})),...Object.entries(accounting.REPORTS).map(([code,s])=>({code,title:s.title,group:'Accounting & Segmentasi'})),...Object.entries(products.REPORTS).map(([code,s])=>({code,title:s.title,group:'Produk & Inventory'})),...Object.entries(salesReports.REPORTS).map(([code,s])=>({code,title:s.title,group:'Sales Performance'}))]});});
 app.get('/api/report-center/accounting/outlets',...guards,async(_req,res)=>{try{const outlets=await require('./accounting-sales-store').listOutlets();res.set('Cache-Control','no-store');res.json((outlets||[]).map(o=>({id:o.id,name:o.name})));}catch(e){fail(res,e);}});
 app.get('/api/report-center/:code/data',...guards,async(req,res)=>{try{const {from,to}=dates(req);res.set('Cache-Control','no-store');res.json(await getData(db,req.params.code,from,to,req.query));}catch(e){fail(res,e);}});
 app.get('/api/report-center/:code/export.:format',...guards,async(req,res)=>{try{
  const format=String(req.params.format).toLowerCase();if(!['pdf','xlsx'].includes(format))return res.status(400).json({error:'Format tidak didukung'});
  const {from,to}=dates(req),data=await getData(db,req.params.code,from,to,req.query);
  res.set('Cache-Control','no-store');const title=(data.title+' '+(from||'Semua')+' '+(to||'')).trim();
  if(format==='pdf'){
   const slim=data.source==='Accounting'&&data.columns.length>10
    ?data.rows.map(r=>Object.fromEntries(['Tanggal','Outlet','Klasifikasi','Customer','Kategori Produk','Omzet (Rp)','HPP (Rp)','DPP (Rp)','PPN (Rp)','NET (Rp)'].map(k=>[k,r[k]])))
    :data.rows;
   return reportSvc.writePdf(res,title,slim);
  }
  return await reportSvc.writeExcel(res,title,data.rows);
 }catch(e){fail(res,e);}});
}
module.exports={install,REPORTS,superadminOnly,dateParam,project,getData};
