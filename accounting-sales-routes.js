'use strict';
const express=require('express');
const {
  CLASSIFICATIONS,
  normalizeAccountingTransactionInput,
  resolveAccountingClassification,
  filterTransactions,
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
function queryFilters(q={}){
  return {...periodBounds(q),classification:clean(q.classification),sub_classification:clean(q.sub_classification),pic_name:clean(q.pic_name),product_category:clean(q.product_category)};
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
async function applyClassification(store,input){
  if(clean(input.classification_source)==='MANUAL_OVERRIDE') return {...input,classification_source:'MANUAL_OVERRIDE'};
  const [customers,pics]=await Promise.all([store.listMasters('customers',false),store.listMasters('pics',false)]);
  const customer=customers.find(x=>clean(x.name).toLowerCase()===clean(input.customer_name).toLowerCase())||null;
  const pic=pics.find(x=>clean(x.name).toLowerCase()===clean(input.pic_name).toLowerCase())||null;
  const resolved=resolveAccountingClassification({manual:input.classification},customer,pic);
  return {...input,classification:resolved.classification,classification_source:resolved.source};
}
function normalizeMasterInput(type,body={}){
  const name=clean(body.name);if(!name)throw new Error('Nama master wajib diisi.');
  const row={name,is_active:body.is_active!==false,updated_at:new Date().toISOString()};
  if(type==='customers'||type==='pics'){
    const c=clean(body.default_classification);
    if(c&&!CLASSIFICATIONS.includes(c))throw new Error('Default klasifikasi tidak valid.');
    row.default_classification=c||null;
  }
  return row;
}
function createAccountingRouter({store}){
  const router=express.Router();
  router.get('/transactions',asyncRoute(async(req,res)=>res.json(await store.listTransactions(queryFilters(req.query)))));
  router.get('/transactions/:id',asyncRoute(async(req,res)=>{const row=await store.getTransaction(req.params.id);if(!row||row.deleted_at)return res.status(404).json({error:'Transaksi tidak ditemukan.'});res.json(row);}));
  router.post('/transactions',asyncRoute(async(req,res)=>{
    const classified=await applyClassification(store,req.body||{});
    const row=normalizeAccountingTransactionInput(classified);
    const actor=clean(req.session?.user?.name||req.session?.user?.username);
    const saved=await store.insertTransaction({...row,created_by:actor,updated_by:actor});
    res.status(201).json(saved);
  }));
  router.patch('/transactions/:id',asyncRoute(async(req,res)=>{
    const current=await store.getTransaction(req.params.id);if(!current||current.deleted_at)return res.status(404).json({error:'Transaksi tidak ditemukan.'});
    const classified=await applyClassification(store,{...current,...req.body});
    const row=normalizeAccountingTransactionInput(classified);
    const actor=clean(req.session?.user?.name||req.session?.user?.username);
    const saved=await store.updateTransaction(req.params.id,{...row,updated_by:actor,updated_at:new Date().toISOString()});
    res.json(saved);
  }));
  router.delete('/transactions/:id',asyncRoute(async(req,res)=>{
    const actor=clean(req.session?.user?.name||req.session?.user?.username);
    const saved=await store.softDeleteTransaction(req.params.id,actor);if(!saved)return res.status(404).json({error:'Transaksi tidak ditemukan.'});res.json({ok:true});
  }));
  router.get('/dashboard',asyncRoute(async(req,res)=>{
    const rows=await store.listTransactions(queryFilters(req.query));
    res.json(aggregateAccountingDashboard(rows));
  }));
  router.get('/export',asyncRoute(async(req,res)=>{
    const periods=exportPeriods(req.query),periodRows={};
    for(const period of periods){
      const [year,month]=period.split('-');
      const last=new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
      periodRows[period]=await store.listTransactions({from:`${period}-01`,to:`${period}-${String(last).padStart(2,'0')}`});
    }
    const wb=await buildAccountingWorkbook(periodRows);
    const buffer=Buffer.from(await wb.xlsx.writeBuffer());
    const suffix=periods.length===1?periods[0]:`${periods[0]}_sd_${periods[periods.length-1]}`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="Accounting_Transaksi_${suffix}.xlsx"`);
    res.send(buffer);
  }));
  router.get('/masters/:type',asyncRoute(async(req,res)=>res.json(await store.listMasters(req.params.type,String(req.query.include_inactive||'')==='1'))));
  router.post('/masters/:type',asyncRoute(async(req,res)=>{const row=normalizeMasterInput(req.params.type,req.body);const saved=await store.createMaster(req.params.type,{...row,created_at:new Date().toISOString()});res.status(201).json(saved);}));
  router.patch('/masters/:type/:id',asyncRoute(async(req,res)=>res.json(await store.updateMaster(req.params.type,req.params.id,normalizeMasterInput(req.params.type,req.body)))));
  router.delete('/masters/:type/:id',asyncRoute(async(req,res)=>{await store.deactivateMaster(req.params.type,req.params.id);res.json({ok:true});}));
  router.use((err,req,res,next)=>{
    if(res.headersSent)return next(err);
    const upstream=Number(err?.status||0);
    const status=upstream>=400&&upstream<600?upstream:400;
    res.status(status).json({error:err?.message||'Accounting request gagal.'});
  });
  return router;
}
module.exports={createAccountingRouter,periodBounds,queryFilters,normalizeMasterInput,exportPeriods};
