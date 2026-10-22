'use strict';
const cfg=require('./config');
const fetchImpl=global.fetch||require('node-fetch');

const ACCOUNTING_TABLES={
  outlets:'accounting_outlets',
  transactions:'accounting_sales_transactions',
  audit:'accounting_sales_transaction_audit',
  customers:'accounting_customers',
  pics:'accounting_pics',
  categories:'accounting_product_categories',
  payments:'accounting_payment_methods'
};
const BASE=String(cfg.POSTGREST_URL||'').replace(/\/$/,'')+'/rest/v1';
const KEY=cfg.POSTGREST_KEY;
function headers(prefer='return=representation'){
  return {apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:prefer};
}
async function request(method,table,query='',body,prefer='return=representation'){
  if(!Object.values(ACCOUNTING_TABLES).includes(table)) throw new Error('Accounting table tidak diizinkan.');
  const r=await fetchImpl(`${BASE}/${table}${query?`?${query}`:''}`,{method,headers:headers(prefer),body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();
  if(!r.ok){const e=new Error(text||`PostgREST HTTP ${r.status}`);e.status=r.status;throw e;}
  if(!text)return null;
  try{return JSON.parse(text);}catch(_){return text;}
}
const enc=encodeURIComponent;
const outletPredicate=outletId=>outletId?`outlet_id=eq.${enc(outletId)}`:'';
async function listOutlets(){return await request('GET',ACCOUNTING_TABLES.outlets,'is_active=eq.true&order=sort_order.asc,name.asc')||[];}
function txFilters(filters={}){
  const q=['deleted_at=is.null'];
  if(filters.outlet_id)q.push(outletPredicate(filters.outlet_id));
  if(filters.from)q.push(`transaction_date=gte.${enc(filters.from)}`);
  if(filters.to)q.push(`transaction_date=lte.${enc(filters.to)}`);
  if(filters.classification)q.push(`classification=eq.${enc(filters.classification)}`);
  if(filters.sub_classification)q.push(`sub_classification=eq.${enc(filters.sub_classification)}`);
  if(filters.pic_name)q.push(`pic_name=eq.${enc(filters.pic_name)}`);
  if(filters.product_category)q.push(`product_category=eq.${enc(filters.product_category)}`);
  q.push('order=transaction_date.desc,created_at.desc');
  return q.join('&');
}
async function listTransactions(filters={}){return await request('GET',ACCOUNTING_TABLES.transactions,txFilters(filters))||[];}
async function getTransaction(id,outletId){const q=[`id=eq.${enc(id)}`];if(outletId)q.push(outletPredicate(outletId));q.push('limit=1');const rows=await request('GET',ACCOUNTING_TABLES.transactions,q.join('&'));return rows?.[0]||null;}
async function insertTransaction(row){const rows=await request('POST',ACCOUNTING_TABLES.transactions,'',row);return rows?.[0]||rows;}
async function updateTransaction(id,row,outletId){const q=[`id=eq.${enc(id)}`];if(outletId)q.push(outletPredicate(outletId));const rows=await request('PATCH',ACCOUNTING_TABLES.transactions,q.join('&'),row);return rows?.[0]||rows;}
async function softDeleteTransaction(id,actor,outletId){const current=await getTransaction(id,outletId);if(!current)return null;await request('POST',ACCOUNTING_TABLES.audit,'',{transaction_id:id,action:'DELETE',snapshot:current,actor});const q=[`id=eq.${enc(id)}`];if(outletId)q.push(outletPredicate(outletId));const rows=await request('PATCH',ACCOUNTING_TABLES.transactions,q.join('&'),{deleted_at:new Date().toISOString(),deleted_by:actor,updated_by:actor,updated_at:new Date().toISOString()});return rows?.[0]||rows;}
const masterTable=type=>({customers:ACCOUNTING_TABLES.customers,pics:ACCOUNTING_TABLES.pics,categories:ACCOUNTING_TABLES.categories,payments:ACCOUNTING_TABLES.payments}[type]);
function assertMaster(type){const t=masterTable(type);if(!t)throw new Error('Master Accounting tidak valid.');return t;}
async function listMasters(type,outletId,includeInactive=false){
  if(typeof outletId==='boolean'){includeInactive=outletId;outletId='';}
  const t=assertMaster(type),q=[];if(outletId)q.push(outletPredicate(outletId));if(!includeInactive)q.push('is_active=eq.true');q.push('order=name.asc');return await request('GET',t,q.join('&'))||[];
}
async function getMaster(type,id,outletId){const q=[`id=eq.${enc(id)}`];if(outletId)q.push(outletPredicate(outletId));q.push('limit=1');const rows=await request('GET',assertMaster(type),q.join('&'));return rows?.[0]||null;}
async function createMaster(type,row){const rows=await request('POST',assertMaster(type),'',row);return rows?.[0]||rows;}
async function updateMaster(type,id,row,outletId){const q=[`id=eq.${enc(id)}`];if(outletId)q.push(outletPredicate(outletId));const rows=await request('PATCH',assertMaster(type),q.join('&'),row);return rows?.[0]||rows;}
async function deactivateMaster(type,id,outletId){return updateMaster(type,id,{is_active:false,updated_at:new Date().toISOString()},outletId);}
module.exports={ACCOUNTING_TABLES,listOutlets,listTransactions,getTransaction,insertTransaction,updateTransaction,softDeleteTransaction,listMasters,getMaster,createMaster,updateMaster,deactivateMaster};
