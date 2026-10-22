'use strict';
const assert=require('assert');
const express=require('express');
const {createAccountingRouter}=require('../accounting-sales-routes');
const B='11111111-1111-4111-8111-111111111111';
const L='22222222-2222-4222-8222-222222222222';
const G='33333333-3333-4333-8333-333333333333';
const outlets=[{id:B,code:'BUDUK',name:'Buduk',sort_order:10},{id:L,code:'LUKLUK',name:'Lukluk',sort_order:20},{id:G,code:'BANGLI',name:'Bangli',sort_order:30}];
const calls=[];
const tx={id:'tx1',outlet_id:B,transaction_date:'2026-10-01',classification:'B2C',sub_classification:'Project',customer_name:'A',job_name:'',transaction_description:'X',gross_amount:1000,hpp_amount:100,product_category:'CCTV',payment_method:'Transfer Bank',paid_status:'PAID',sales_type:'BARANG',pic_name:'Eka',classification_source:'MANUAL'};
const store={
  listOutlets:async()=>outlets,
  listTransactions:async f=>{calls.push(['listTransactions',f]);return [{...tx,outlet_name:'Buduk',dpp_amount:901,ppn_amount:99,net_amount:801,goods_amount:1000,service_amount:0}]},
  getTransaction:async(id,outlet)=>{calls.push(['getTransaction',id,outlet]);return id==='tx1'&&(!outlet||outlet===B)?{...tx}:null},
  insertTransaction:async row=>{calls.push(['insertTransaction',row]);return {id:'new',...row}},
  updateTransaction:async(id,row,outlet)=>{calls.push(['updateTransaction',id,row,outlet]);return {id,...row,outlet_id:outlet}},
  softDeleteTransaction:async(id,actor,outlet)=>{calls.push(['softDeleteTransaction',id,actor,outlet]);return outlet===B?{id}:null},
  listMasters:async(type,outlet)=>{calls.push(['listMasters',type,outlet]);return type==='customers'?[{name:'A',default_classification:'B2C',outlet_id:outlet}]:type==='pics'?[{name:'Eka',default_classification:'B2B',outlet_id:outlet}]:[]},
  getMaster:async(type,id,outlet)=>{calls.push(['getMaster',type,id,outlet]);return outlet===B?{id,name:'Eka',outlet_id:B}:null},
  createMaster:async(type,row)=>{calls.push(['createMaster',type,row]);return {id:'m1',...row}},
  updateMaster:async(type,id,row,outlet)=>{calls.push(['updateMaster',type,id,row,outlet]);return {id,...row,outlet_id:outlet}},
  deactivateMaster:async(type,id,outlet)=>{calls.push(['deactivateMaster',type,id,outlet]);return outlet===B?{id}:null}
};
function body(){return {outlet_id:B,transaction_date:'2026-10-01',classification:'B2C',sub_classification:'Project',customer_name:'A',job_name:'',transaction_description:'X',gross_amount:1000,hpp_amount:100,product_category:'CCTV',payment_method:'Transfer Bank',paid_status:'PAID',sales_type:'BARANG',pic_name:'Eka'};}
(async()=>{
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={user:{name:'Tester',role:'superadmin'}};next();});app.use('/accounting',createAccountingRouter({store}));
  const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});const base=`http://127.0.0.1:${server.address().port}/accounting`;
  const req=async(path,opt={})=>{const r=await fetch(base+path,{headers:{'content-type':'application/json'},...opt,body:opt.body?JSON.stringify(opt.body):undefined});let data;try{data=await r.json()}catch{data=null}return {status:r.status,data};};
  try{
    let r=await req('/outlets');assert.equal(r.status,200);assert.deepEqual(r.data.map(x=>x.code),['BUDUK','LUKLUK','BANGLI']);
    r=await req('/transactions',{method:'POST',body:{...body(),outlet_id:''}});assert.equal(r.status,400);
    r=await req('/transactions?scope=all',{method:'POST',body:{...body(),outlet_id:''}});assert.equal(r.status,400);
    calls.length=0;r=await req('/transactions',{method:'POST',body:body()});assert.equal(r.status,201);assert.equal(calls.find(x=>x[0]==='insertTransaction')[1].outlet_id,B);assert.ok(calls.some(x=>x[0]==='listMasters'&&x[2]===B));
    r=await req(`/transactions/tx1?outlet_id=${L}`,{method:'PATCH',body:{...body(),outlet_id:L}});assert.equal(r.status,404);
    r=await req(`/transactions/tx1?outlet_id=${B}`,{method:'PATCH',body:{...body(),outlet_id:L}});assert.equal(r.status,400);
    r=await req(`/transactions/tx1?outlet_id=${B}`,{method:'PATCH',body:{transaction_description:'Updated'}});assert.equal(r.status,200);assert.equal(r.data.outlet_id,B);
    r=await req(`/transactions/tx1?outlet_id=${L}`,{method:'DELETE'});assert.equal(r.status,404);
    calls.length=0;r=await req(`/dashboard?outlet_id=${B}`);assert.equal(r.status,200);assert.equal(calls.find(x=>x[0]==='listTransactions')[1].outlet_id,B);
    calls.length=0;r=await req('/dashboard?scope=all');assert.equal(r.status,200);assert.equal(calls.find(x=>x[0]==='listTransactions')[1].outlet_id,undefined);assert.ok(Array.isArray(r.data.charts.revenue_by_outlet));
    r=await req('/masters/pics',{method:'POST',body:{outlet_id:'',name:'Eka'}});assert.equal(r.status,400);
    calls.length=0;r=await req('/masters/pics',{method:'POST',body:{outlet_id:B,name:'Eka',default_classification:'B2B'}});assert.equal(r.status,201);assert.equal(calls.find(x=>x[0]==='createMaster')[2].outlet_id,B);
    calls.length=0;r=await req(`/masters/pics?outlet_id=${L}`);assert.equal(r.status,200);assert.ok(calls.some(x=>x[0]==='listMasters'&&x[2]===L));
    console.log('Accounting multi-outlet API tests complete');
  } finally {server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
