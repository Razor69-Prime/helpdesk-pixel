'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {buildRows,validateUpdate,canView,canManage}=require('../pxl-sales-bill-0001-core');
const wo=[{id:'w1',wo_number:'WO-001',sales_order_id:'s1',status:'done',customer_name:'Customer A',project_name:'Service',worked_at:'2026-11-24',source_type:'sales_order'},
 {id:'w2',wo_number:'WO-002',status:'done',created_by:'Sales A',customer_name:'Customer B',worked_at:'2026-11-25',source_type:'manual'},
 {id:'w3',wo_number:'WO-003',status:'assigned',created_by:'Sales A'},
 {id:'w4',wo_number:'WO-004',status:'cancelled',created_by:'Sales A'},
 {id:'w5',wo_number:'WO-005',status:'done',created_by:'Sales B'}];
const so=[{id:'s1',so_number:'SO-001',sales_pic:'Sales A',sales_pic_user_id:'usr-a',total_amount:500000}];
const sales={id:'usr-a',name:'Sales A',role:'sales'},manager={name:'Manager',role:'manager'},tech={name:'Tech',role:'technician'};
test('completed SO WO with omzet -> pending note, completed manual WO -> needs review',()=>{const arr=buildRows(wo,so,[],sales);assert.equal(arr.length,2);assert.deepEqual(arr.map(x=>x.status),['needs_review','pending_note']);assert.equal(arr.find(x=>x.wo_id==='w1').revenue_amount,500000);assert.equal(arr.find(x=>x.wo_id==='w2').revenue_amount,null)});
test('sales only sees own WO; manager sees all completed; technician cannot access',()=>{assert.deepEqual(buildRows(wo,so,[],sales).map(x=>x.wo_id).sort(),['w1','w2']);assert.deepEqual(buildRows(wo,so,[],manager).map(x=>x.wo_id).sort(),['w1','w2','w5']);assert.equal(buildRows(wo,so,[],tech).length,0);assert.equal(canView(tech),false);assert.equal(canManage({role:'accounting'}),false)});
test('manual note requires positive omzet and valid date, never marks WO status',()=>{assert.throws(()=>validateUpdate({status:'noted',revenue_amount:450000},{}),/Tanggal nota/);assert.throws(()=>validateUpdate({status:'noted',revenue_amount:0,note_date:'2026-11-26'},{}),/omzet/);const result=validateUpdate({status:'noted',revenue_amount:450000,note_date:'2026-11-26',note_number:'N-45'},{});assert.deepEqual(result,{status:'noted',revenue_amount:450000,note_number:'N-45',note_date:'2026-11-26',reason:null})});
test('no-revenue requires reason; pending note requires nominal; clear incompatible note fields',()=>{assert.throws(()=>validateUpdate({status:'no_revenue'},{}),/Alasan/);assert.throws(()=>validateUpdate({status:'pending_note',revenue_amount:0},{}),/omzet/);const r=validateUpdate({status:'no_revenue',reason:'Garansi',revenue_amount:10000,note_date:'2026-11-25'},{});assert.equal(r.status,'no_revenue');assert.equal(r.revenue_amount,null);assert.equal(r.note_date,null)});
test('existing confirmations overlay inferred WO and never change base WO object',()=>{const before=JSON.stringify(wo);const saved=[{wo_id:'w1',status:'noted',note_number:'Nota 12',note_date:'2026-11-26',revenue_amount:500000}];const result=buildRows(wo,so,saved,manager);assert.equal(result.find(x=>x.wo_id==='w1').status,'noted');assert.equal(JSON.stringify(wo),before)});
test('server and UI are isolated from original WO closing and invoice',()=>{const server=fs.readFileSync('server.js','utf8');const api=fs.readFileSync('pxl-sales-bill-0001-api.js','utf8');const html=fs.readFileSync('public/index.html','utf8');const js=fs.readFileSync('public/pxl-sales-bill-0001.js','utf8');new vm.Script(js);assert.match(server,/require\('\.\/pxl-sales-bill-0001-api'\)/);assert.match(api,/sales_wo_billing\?on_conflict=wo_id/);assert.doesNotMatch(api,/updateTicket|updateSalesOrder|insertInvoice|updateInventory/);assert.match(html,/Reminder Nota WO/);assert.match(html,/tab-sales_wo_reminder/);assert.match(html,/pxl-sales-bill-0001\.js/)});
test('SQL has separate audit trigger, no WO invoice or Inventory mutations',()=>{const sql=fs.readFileSync('PXL-SALES-BILL-0001-MIGRATION.sql','utf8');assert.match(sql,/CREATE TRIGGER sales_wo_billing_audit/);assert.match(sql,/REFERENCES public\.tickets\(id\)/);assert.doesNotMatch(sql,/ALTER TABLE public\.tickets|UPDATE public\.tickets|ALTER TABLE public\.inventory|DELETE FROM public\.tickets/)});

test('API GET returns only authorized completed WO; POST persists separately and blocks technician',async()=>{
 const handlers=new Map(),app={get:(path,...fn)=>handlers.set('GET '+path,fn.at(-1)),post:(path,...fn)=>handlers.set('POST '+path,fn.at(-1))};
 const orig=global.fetch,requests=[];
 global.fetch=async(url,options)=>{
   const method=options.method,pathname=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
   requests.push({method,pathname,body});
   const data=pathname.endsWith('sales_wo_billing')?(method==='POST'?[body]:[]):[];
   return {ok:true,status:200,text:async()=>JSON.stringify(data)};
 };
 const configPath=require.resolve('../config'),oldConfig=require.cache[configPath];
 require.cache[configPath]={id:configPath,filename:configPath,loaded:true,exports:{POSTGREST_URL:'http://127.0.0.1:9999',POSTGREST_KEY:'fake-test-key'}};
 try{
  require('../pxl-sales-bill-0001-api')(app,{db:{getTickets:async()=>wo,getSalesOrders:async()=>so},requireAuth:(r,s,next)=>next()});
  let status=200,body,headers={};const res={set(k,v){headers[k]=v;return this},status(n){status=n;return this},json(x){body=x;return this}};
  await handlers.get('GET /api/sales-wo-reminder')({session:{user:tech}},res);
  assert.equal(status,403);assert.equal(requests.length,0);
  status=200;
  await handlers.get('GET /api/sales-wo-reminder')({session:{user:sales}},res);
  assert.equal(status,200);assert.equal(body.rows.length,2);assert.equal(headers['Cache-Control'],'no-store');
  status=200;
  await handlers.get('POST /api/sales-wo-reminder/:id')({session:{user:sales},params:{id:'w1'},body:{status:'noted',revenue_amount:500000,note_number:'NM-001',note_date:'2026-11-26'}},res);
  assert.equal(status,200);assert.equal(body.status,'noted');assert.equal(body.wo_id,'w1');
  assert.ok(requests.some(x=>x.method==='POST'&&x.pathname.endsWith('sales_wo_billing')));
  assert.equal(wo[0].status,'done');
  status=200;await handlers.get('POST /api/sales-wo-reminder/:id')({session:{user:sales},params:{id:'w5'},body:{status:'no_revenue',reason:'Garansi'}},res);assert.equal(status,404);
 }finally{global.fetch=orig;if(oldConfig)require.cache[configPath]=oldConfig;else delete require.cache[configPath];}
});
