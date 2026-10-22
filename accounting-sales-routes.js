'use strict';
const express=require('express');
const {
  CLASSIFICATIONS,
  normalizeOutletId,
  normalizeAccountingTransactionInput,
  resolveAccountingClassification,
  aggregateAccountingDashboard
}=require('./accounting-sales-v1');
const {buildAccountingWorkbook}=require('./accounting-sales-export');

function clean(v){return String(v??'').trim();}
function asyncRoute(fn){return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);}
function periodBounds(q={}){
  const year=String(q.year||'').trim(),month=String(q.month||'').trim();
  if(/^\d{4}$/.test(year)&&/^\d{1,2}$/.test(month)){
    const m=String(Number(month)).padStart(2,'0');
    const last=new Date(Date.UTC(Number(year),Number(m),0)).getUTCDate();
    return {from:`${year}-${m}-01`,to:`${year}-${m}-${String(last).padStart(2,'0')}`};
  }
  return {from:clean(q.from),to:clean(q.to)};
}
function isAllOutletScope(req){return clean(req?.query?.scope).toLowerCase()==='all';}
function outletIdFromRequest(req,{required=false}={}){
  const raw=clean(req?.query?.outlet_id)||clean(req?.body?.outlet_id);
  if(!raw){if(required)throw new Error('Outlet wajib dipilih.');return '';}
  return normalizeOutletId(raw);
}
function queryFilters(q={}){
  const outletRaw=clean(q.outlet_id);
  return {...periodBounds(q),outlet_id:outletRaw?normalizeOutletId(outletRaw):'',classification:clean(q.classification),sub_classification:clean(q.sub_classification),pic_name:clean(q.pic_name),product_category:clean(q.product_category)};
}
function accountingExportFilename(scope,outletName,suffix){
  const safe=String(outletName||'').trim().replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
  return scope==='all'?`Accounting_Semua_Outlet_${suffix}.xlsx`:`Accounting_${safe||'Outlet'}_${suffix}.xlsx`;
}
function exportPeriods(q={}){
  const raw=clean(q.periods);
  const out=raw?raw.split(',').map(x=>x.trim()).filter(Boolean):[];
  if(!out.length&&/^\d{4}$/.test(clean(q.year))&&/^\d{1,2}$/.test(clean(q.month))) out.push(`${clean(q.year)}-${String(Number(q.month)).padStart(2,'0')}`);
  const valid=[...new Set(out.filter(x=>/^\d{4}-(0[1-9]|1[0-2])$/.test(x)))];
  if(!valid.length) throw new Error('Periode export wajib dipilih.');
  if(valid.length>24) throw new Error('Maksimal 24 bulan per export.');
  return valid.sort();
}
async function applyClassification(store,input,outletId){
  if(clean(input.classification_source)==='MANUAL_OVERRIDE') return {...input,classification_source:'MANUAL_OVERRIDE'};
  const [customers,pics]=await Promise.all([store.listMasters('customers',outletId,false),store.listMasters('pics',outletId,false)]);
  const customer=customers.find(x=>clean(x.name).toLowerCase()===clean(input.customer_name).toLowerCase())||null;
  const pic=pics.find(x=>clean(x.name).toLowerCase()===clean(input.pic_name).toLowerCase())||null;
  const resolved=resolveAccountingClassification({manual:input.classification},customer,pic);
  return {...input,classification:resolved.classification,classification_source:resolved.source};
}
function normalizeMasterInput(type,body={},outletId){
  const name=clean(body.name);if(!name)throw new Error('Nama master wajib diisi.');
  const row={name,is_active:body.is_active!==false,updated_at:new Date().toISOString()};
  if(outletId)row.outlet_id=normalizeOutletId(outletId);
  if(type==='customers'||type==='pics'){
    const c=clean(body.default_classification);
    if(c&&!CLASSIFICATIONS.includes(c))throw new Error('Default klasifikasi tidak valid.');
    row.default_classification=c||null;
  }
  return row;
}
function createAccountingRouter({store}){
  const router=express.Router();
  router.get('/outlets',asyncRoute(async(req,res)=>res.json(await store.listOutlets())));
  router.get('/transactions',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    res.json(await store.listTransactions({...queryFilters(req.query),outlet_id:outletId}));
  }));
  router.get('/transactions/:id',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const row=await store.getTransaction(req.params.id,outletId);if(!row||row.deleted_at)return res.status(404).json({error:'Transaksi tidak ditemukan.'});res.json(row);
  }));
  router.post('/transactions',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const classified=await applyClassification(store,req.body||{},outletId);
    const row=normalizeAccountingTransactionInput(classified);
    const actor=clean(req.session?.user?.name||req.session?.user?.username);
    const saved=await store.insertTransaction({...row,outlet_id:outletId,created_by:actor,updated_by:actor});
    res.status(201).json(saved);
  }));
  router.patch('/transactions/:id',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const current=await store.getTransaction(req.params.id,outletId);if(!current||current.deleted_at)return res.status(404).json({error:'Transaksi tidak ditemukan.'});
    if(clean(req.body?.outlet_id)&&normalizeOutletId(req.body.outlet_id)!==current.outlet_id) throw new Error('Outlet transaksi tidak dapat diubah.');
    const classified=await applyClassification(store,{...current,...req.body,outlet_id:current.outlet_id},current.outlet_id);
    const row=normalizeAccountingTransactionInput(classified);
    const actor=clean(req.session?.user?.name||req.session?.user?.username);
    const saved=await store.updateTransaction(req.params.id,{...row,updated_by:actor,updated_at:new Date().toISOString()},current.outlet_id);
    res.json(saved);
  }));
  router.delete('/transactions/:id',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const current=await store.getTransaction(req.params.id,outletId);if(!current||current.deleted_at)return res.status(404).json({error:'Transaksi tidak ditemukan.'});
    const actor=clean(req.session?.user?.name||req.session?.user?.username);
    const saved=await store.softDeleteTransaction(req.params.id,actor,outletId);if(!saved)return res.status(404).json({error:'Transaksi tidak ditemukan.'});res.json({ok:true});
  }));
  router.get('/dashboard',asyncRoute(async(req,res)=>{
    const all=isAllOutletScope(req);
    const outletId=all?'':outletIdFromRequest(req,{required:true});
    const filters=queryFilters(req.query);if(all)delete filters.outlet_id;else filters.outlet_id=outletId;
    const rows=await store.listTransactions(filters);
    let outlets=[];
    if(all){
      outlets=await store.listOutlets();const names=new Map(outlets.map(o=>[o.id,o.name]));
      for(const row of rows)row.outlet_name=row.outlet_name||names.get(row.outlet_id)||row.outlet_id;
    }
    res.json(aggregateAccountingDashboard(rows,{scope:all?'all':'outlet',outlets:all?outlets:[]}));
  }));
  router.get('/export',asyncRoute(async(req,res)=>{
    const all=isAllOutletScope(req),outletId=all?'':outletIdFromRequest(req,{required:true});
    const outlets=await store.listOutlets(),outletMap=new Map(outlets.map(o=>[o.id,o.name]));
    const outletName=all?'':outletMap.get(outletId);
    if(!all&&!outletName) throw new Error('Outlet tidak valid.');
    const periods=exportPeriods(req.query),periodRows={};
    for(const period of periods){
      const [year,month]=period.split('-');
      const last=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
      const filters={from:`${period}-01`,to:`${period}-${String(last).padStart(2,'0')}`};if(!all)filters.outlet_id=outletId;
      const rows=await store.listTransactions(filters);
      periodRows[period]=all?rows.map(r=>({...r,outlet_name:r.outlet_name||outletMap.get(r.outlet_id)||r.outlet_id})):rows;
    }
    const scope=all?'all':'outlet';
    const wb=await buildAccountingWorkbook(periodRows,{scope,outletName,outletId});
    const buffer=Buffer.from(await wb.xlsx.writeBuffer());
    const suffix=periods.length===1?periods[0]:`${periods[0]}_sd_${periods[periods.length-1]}`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${accountingExportFilename(scope,outletName,suffix)}"`);
    res.send(buffer);
  }));
  router.get('/masters/:type',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    res.json(await store.listMasters(req.params.type,outletId,String(req.query.include_inactive||'')==='1'));
  }));
  router.post('/masters/:type',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const row=normalizeMasterInput(req.params.type,req.body,outletId);
    const saved=await store.createMaster(req.params.type,{...row,created_at:new Date().toISOString()});res.status(201).json(saved);
  }));
  router.patch('/masters/:type/:id',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const current=await store.getMaster(req.params.type,req.params.id,outletId);if(!current)return res.status(404).json({error:'Master Accounting tidak ditemukan.'});
    if(clean(req.body?.outlet_id)&&normalizeOutletId(req.body.outlet_id)!==current.outlet_id) throw new Error('Outlet master tidak dapat diubah.');
    res.json(await store.updateMaster(req.params.type,req.params.id,normalizeMasterInput(req.params.type,req.body,current.outlet_id),current.outlet_id));
  }));
  router.delete('/masters/:type/:id',asyncRoute(async(req,res)=>{
    const outletId=outletIdFromRequest(req,{required:true});
    const current=await store.getMaster(req.params.type,req.params.id,outletId);if(!current)return res.status(404).json({error:'Master Accounting tidak ditemukan.'});
    await store.deactivateMaster(req.params.type,req.params.id,outletId);res.json({ok:true});
  }));
  router.use((err,req,res,next)=>{
    if(res.headersSent)return next(err);
    const upstream=Number(err?.status||0);
    const status=upstream>=400&&upstream<600?upstream:400;
    res.status(status).json({error:err?.message||'Accounting request gagal.'});
  });
  return router;
}
module.exports={createAccountingRouter,periodBounds,queryFilters,normalizeMasterInput,exportPeriods,outletIdFromRequest,isAllOutletScope,applyClassification,accountingExportFilename};
