'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'public/pxl-urg-0144-pr-edit-integrity.js'),'utf8');
function makeRows(items){
  return items.map(item=>{
    const selectors=['.pr-desc','.pr-qty','.pr-unit','.pr-price','.pr-stock','.pr-ket'];
    const inputs=Object.fromEntries(selectors.map(x=>[x,{value:''}]));
    const supplier={value:'',options:[{value:''},{value:'supplier-1'}]};
    return {dataset:{},querySelector:x=>x==='.pr-supplier'?supplier:inputs[x]||null};
  });
}
const fixtures=[
 {id:'pr106',pr_number:'PR-106',items:Array.from({length:28},(_,i)=>({desc:'Item PR106 '+(i+1),qty:i+1,unit:'pcs',price:(i+1)*1000,inventory_item_id:'inv-'+i,inventory_sku:'PX-'+i,source_key:'MANUAL:PROBUS:PX-'+i}))},
 {id:'pr107',pr_number:'PR-107',items:Array.from({length:21},(_,i)=>({desc:'Item PR107 '+(i+1),qty:i+1,unit:'pcs',price:(i+1)*3000,inventory_item_id:'inv-'+i,inventory_sku:'PX-'+i,source_key:'MANUAL:PROBUS:PX-'+i}))}
];
function makeContext(entry,{reject=false,corrupt=true}={}){
 let list=[],opened=0,submitCount=0,totalUpdates=0,alerts=[],loadCalls=0,prData=[{...entry,items:[]}];
 const form={replaceChildren(){list=[]}};
 const document={addEventListener(){},getElementById:id=>id==='pr-items-body'?form:null,querySelectorAll:selector=>selector==='#pr-items-body tr'?list:[]};
 const win={
  api:async(method,url)=>{loadCalls++;if(reject)throw Error('HTTP 503');assert.equal(method,'GET');assert.equal(url,'/purchase-requests/'+entry.id);return structuredClone(entry)},
  showPRForm:async()=>{opened++;list=makeRows(entry.items);if(corrupt){list[0].querySelector('.pr-desc').value=entry.items.map(x=>x.desc).join(' - ');list[0].querySelector('.pr-price').value=entry.items.reduce((s,x)=>s+x.qty*x.price,0);for(let i=1;i<list.length;i++)list[i].querySelector('.pr-desc').value='';}},
  updatePRTotal:()=>totalUpdates++,
  cancelPRForm:()=>{list=[]},
  submitPR:()=>{submitCount++},
  addPRItem:item=>{const r=makeRows([item])[0];list.push(r)},
  editPR:()=>{},
 };
 const ctx={window:win,document,alert:x=>alerts.push(x),setTimeout:()=>{},console,encodeURIComponent,Promise};
 Object.defineProperty(ctx,'prData',{get:()=>prData,set:x=>{prData=x}});
 Object.defineProperty(ctx,'prEditId',{get:()=>entry.id,set:()=>{}});
 Object.defineProperty(ctx,'prItemCount',{get:()=>0,set:()=>{}});
 vm.runInNewContext(script,ctx,{filename:'pxl-urg-0144-pr-edit-integrity.js'});
 win.PXL_URG_0144.install();
 return {win,rows:()=>list,alerts,opened:()=>opened,submitCount:()=>submitCount,totalUpdates:()=>totalUpdates,prData:()=>prData,loads:()=>loadCalls};
}
for(const f of fixtures)test(f.pr_number+' edit restores every description, qty, price, inventory link from broken merged summary',async()=>{
 const h=makeContext(f);await h.win.editPR(f.id);
 assert.equal(h.opened(),1);assert.equal(h.rows().length,f.items.length);
 for(let i=0;i<f.items.length;i++){
  const row=h.rows()[i],item=f.items[i];
  assert.equal(row.querySelector('.pr-desc').value,item.desc);
  assert.equal(Number(row.querySelector('.pr-qty').value),item.qty);
  assert.equal(Number(row.querySelector('.pr-price').value),item.price);
  assert.equal(row.dataset.inventoryItemId,item.inventory_item_id);
  assert.equal(row.dataset.sourceKey,item.source_key);
 }
 assert.equal(h.prData()[0].items.length,f.items.length);
 assert.equal(h.alerts.length,0);
 assert.ok(h.totalUpdates()>0);
});
test('failed full detail request never opens unsafe PR editor',async()=>{
 const h=makeContext(fixtures[1],{reject:true});await h.win.editPR('pr107');
 assert.equal(h.opened(),0);assert.equal(h.alerts.length,1);assert.match(h.alerts[0],/Data tersimpan tidak diubah/);
});
test('empty draft lines cannot silently overwrite saved PR item list',async()=>{
 const h=makeContext(fixtures[0]);await h.win.editPR('pr106');
 h.rows()[3].querySelector('.pr-desc').value='';h.win.submitPR();
 assert.equal(h.submitCount(),0);assert.match(h.alerts.at(-1),/Simpan dibatalkan/);
 h.rows()[3].querySelector('.pr-desc').value='Item PR106 4';h.win.submitPR();assert.equal(h.submitCount(),1);
});
test('historical inventory links remain when item is missing from current PROBUS search',async()=>{
 const h=makeContext(fixtures[1]);await h.win.editPR('pr107');assert.equal(h.rows()[3].dataset.inventorySku,'PX-3');
 assert.equal(h.rows()[3].dataset.sourceKey,'MANUAL:PROBUS:PX-3');
});
test('PR detail endpoint recognizes existing Manajemen Akun PR read permissions',async()=>{
 const app={get:(path,...handlers)=>{app.handlers=handlers;app.path=path}};
 const db={getUsers:async()=>[{id:'u-1',role:'technician',pr_roles:['maker_pr']}],getPurchaseRequest:async id=>({id,items:fixtures[0].items})};
 require('../pxl-perf-prjt1-api')(app,{db,requireAuth:(req,res,next)=>next()});
 assert.equal(app.path,'/api/purchase-requests/:id');
 let output;const response={status(n){this.code=n;return this},json(x){output=x;return x}};
 await app.handlers.at(-1)({session:{user:{id:'u-1',role:'technician'}},params:{id:'pr106'}},response);
 assert.equal(output.items.length,28);
 await app.handlers.at(-1)({session:{user:{id:'u-2',role:'technician'}},params:{id:'pr106'}},response);
 assert.equal(response.code,403);
});
test('PR script fast-search decorator waits for supplier async form build before decorating',()=>{
 const source=fs.readFileSync(path.join(root,'public/pxl-pr-inv-0001.js'),'utf8');
 assert.match(source,/out\.then\(value=>\{decorate\(\);return value;\}\)/);
 const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 assert.match(index,/pxl-urg-0144-pr-edit-integrity\.js\?v=PXL-URG-0144/);
});
