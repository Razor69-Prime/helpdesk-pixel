'use strict';
const cfg=require('./config');
const fetchImpl=global.fetch||require('node-fetch');

const ACCOUNTING_TABLES={
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
function txFilters(filters={}){
  const q=['deleted_at=is.null'];
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
async function getTransaction(id){const rows=await request('GET',ACCOUNTING_TABLES.transactions,`id=eq.${enc(id)}&limit=1`);return rows?.[0]||null;}
async function insertTransaction(row){const rows=await request('POST',ACCOUNTING_TABLES.transactions,'',row);return rows?.[0]||rows;}
async function updateTransaction(id,row){const rows=await request('PATCH',ACCOUNTING_TABLES.transactions,`id=eq.${enc(id)}`,row);return rows?.[0]||rows;}
async function softDeleteTransaction(id,actor){const current=await getTransaction(id);if(!current)return null;await request('POST',ACCOUNTING_TABLES.audit,'',{transaction_id:id,action:'DELETE',snapshot:current,actor});const rows=await request('PATCH',ACCOUNTING_TABLES.transactions,`id=eq.${enc(id)}`,{deleted_at:new Date().toISOString(),deleted_by:actor,updated_by:actor,updated_at:new Date().toISOString()});return rows?.[0]||rows;}
const masterTable=type=>({customers:ACCOUNTING_TABLES.customers,pics:ACCOUNTING_TABLES.pics,categories:ACCOUNTING_TABLES.categories,payments:ACCOUNTING_TABLES.payments}[type]);
function assertMaster(type){const t=masterTable(type);if(!t)throw new Error('Master Accounting tidak valid.');return t;}
async function listMasters(type,includeInactive=false){const t=assertMaster(type);const q=includeInactive?'order=name.asc':'is_active=eq.true&order=name.asc';return await request('GET',t,q)||[];}
async function createMaster(type,row){const rows=await request('POST',assertMaster(type),'',row);return rows?.[0]||rows;}
async function updateMaster(type,id,row){const rows=await request('PATCH',assertMaster(type),`id=eq.${enc(id)}`,row);return rows?.[0]||rows;}
async function deactivateMaster(type,id){return updateMaster(type,id,{is_active:false,updated_at:new Date().toISOString()});}
module.exports={ACCOUNTING_TABLES,listTransactions,getTransaction,insertTransaction,updateTransaction,softDeleteTransaction,listMasters,createMaster,updateMaster,deactivateMaster};
