'use strict';
const assert=require('node:assert/strict'),R=require('./report-center-api');
function response(){return {statusCode:200,status(n){this.statusCode=n;return this},json(v){this.payload=v;return this}};}
for(const role of ['sales','manager','admin','technician','accounting','']){const r=response();let passed=false;R.superadminOnly({session:{user:{role}}},r,()=>passed=true);assert.equal(r.statusCode,403);assert.equal(passed,false);}
{const r=response();let passed=false;R.superadminOnly({session:{user:{role:'superadmin'}}},r,()=>passed=true);assert.equal(passed,true);}
{const r=response();R.superadminOnly({session:{}},r,()=>{});assert.equal(r.statusCode,401);}
assert.equal(R.dateParam('2026-11-07'),'2026-11-07');
for(const d of ['2026-02-30','2026-13-01','2026-1-7'])assert.throws(()=>R.dateParam(d));
const rows=R.project([{created_at:'2026-11-07',customer_name:'A',password:'secret'},{created_at:'2026-10-01',customer_name:'B'}],[['customer_name','Customer']],'2026-11-01','2026-11-30');
assert.deepEqual(rows,[{Customer:'A'}]);assert.equal(JSON.stringify(rows).includes('secret'),false);
const reads=[];const db={getCrmReport:async()=>{reads.push('crm');return{tickets:[{wo_number:'WO-1'}]};},getMRForms:async()=>{reads.push('mr');return[]},getPurchaseRequests:async()=>{reads.push('pr');return[]}};
(async()=>{assert.equal((await R.getData(db,'wo',null,null)).rows.length,1);assert.deepEqual(reads,['crm']);await assert.rejects(()=>R.getData(db,'other',null,null),{status:404});
 const routes={};const app={get(path,...handlers){routes[path]=handlers;}};
 R.install(app,{db,requireAuth:(_req,_res,next)=>next(),reportSvc:{writePdf(){},writeExcel(){}}});
 assert.equal(Object.keys(routes).length,4);
 for(const handlers of Object.values(routes)){const r=response();let passed=false;handlers[1]({session:{user:{role:'sales'}}},r,()=>passed=true);assert.equal(r.statusCode,403);assert.equal(passed,false);}
 console.log('PASS: superadmin-only, data projection, date validation, read-only source selection, route protection');
})().catch(e=>{console.error(e);process.exitCode=1;});
