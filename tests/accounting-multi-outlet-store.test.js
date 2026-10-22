'use strict';
const assert=require('assert');
const urls=[];
global.fetch=async(url,opts={})=>{
  urls.push({url:String(url),method:opts.method||'GET',body:opts.body});
  const body=String(url).includes('accounting_outlets')
    ? [{id:'o1',code:'BUDUK',name:'Buduk',sort_order:10}]
    : String(url).includes('id=eq.tx1')?[{id:'tx1',outlet_id:'o1'}]:[];
  return {ok:true,status:200,text:async()=>JSON.stringify(body)};
};
const store=require('../accounting-sales-store');
(async()=>{
  assert.ok(store.ACCOUNTING_TABLES.outlets==='accounting_outlets');
  await store.listOutlets();
  assert.match(urls.at(-1).url,/accounting_outlets\?is_active=eq\.true&order=sort_order\.asc,name\.asc/);
  await store.listTransactions({outlet_id:'o1',from:'2026-10-01'});
  assert.match(urls.at(-1).url,/outlet_id=eq\.o1/);
  const before=urls.length;await store.listTransactions({from:'2026-10-01'});
  assert.equal(urls.length,before+1);assert.doesNotMatch(urls.at(-1).url,/outlet_id=eq/);
  await store.getTransaction('tx1','o1');
  assert.match(urls.at(-1).url,/id=eq\.tx1.*outlet_id=eq\.o1/);
  await store.updateTransaction('tx1',{notes:'x'},'o1');
  assert.match(urls.at(-1).url,/id=eq\.tx1.*outlet_id=eq\.o1/);
  await store.listMasters('pics','o1',false);
  assert.match(urls.at(-1).url,/outlet_id=eq\.o1/);
  await store.getMaster('pics','p1','o1');
  assert.match(urls.at(-1).url,/id=eq\.p1.*outlet_id=eq\.o1/);
  await store.updateMaster('pics','p1',{name:'Eka'},'o1');
  assert.match(urls.at(-1).url,/id=eq\.p1.*outlet_id=eq\.o1/);
  await store.deactivateMaster('pics','p1','o1');
  assert.match(urls.at(-1).url,/id=eq\.p1.*outlet_id=eq\.o1/);
  await store.softDeleteTransaction('tx1','tester','o1');
  const patch=urls.filter(x=>x.method==='PATCH').at(-1);
  assert.match(patch.url,/id=eq\.tx1.*outlet_id=eq\.o1/);
  console.log('Accounting multi-outlet store tests complete');
})().catch(e=>{console.error(e);process.exit(1)});
