'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {patchWoSubmitNumber}=require('../pxl-urg-0133-wo-number-submit');
const {patchWoOptionalTechnician}=require('../pxl-urg-0131-wo-optional-tech');
const {patchWoDetail}=require('../pxl-urg-0123-wo-detail-safe');
const {patchWoMobileGrid}=require('../pxl-urg-0124-wo-mobile-grid');
const {patchWoMenuDateSync}=require('../pxl-urg-0125-wo-menu-date-sync');
const {inject}=require('../pxl-urg-0121-pr-live-load-hook');
const {nextWoNumber}=require('../pxl-urg-0133-wo-number-api');
const served=()=>inject(patchWoSubmitNumber(patchWoOptionalTechnician(patchWoMenuDateSync(patchWoMobileGrid(patchWoDetail(read('public/index.html')))))));
function runtime(rows,{ok=true,wait=false}={}){
  const input={tagName:'INPUT',id:'f-wo',value:'',style:{},readOnly:false,
    setAttribute(k,v){this[k]=v},dispatchEvent(){},getClientRects(){return [1]}};
  const doc={readyState:'loading',querySelectorAll(sel){return sel==='#f-wo'?[input]:[]},addEventListener(){}};
  let hits=0, resolveFetch;
  const fetch=async(uri,options)=>{
    hits++;
    if(wait)await new Promise(resolve=>{resolveFetch=resolve;});
    return {ok,status:ok?200:401,json:async()=>rows};
  };
  const window={};
  vm.runInNewContext(read('public/pxl-urg-0010-wo-autonumber.js'),{
    window,document:doc,fetch,console,Date,Event:class Event{},
    getComputedStyle:()=>({display:'block',visibility:'visible'}),
    localStorage:{getItem:()=> 'mock_token'},
    sessionStorage:{getItem:()=>null},setTimeout:()=>{},clearTimeout:()=>{}
  });
  return {window,input,hits:()=>hits,release:()=>resolveFetch?.()};
}
test('0133 loads WO generator and preserves Master Pricelist/PR/WO optional',()=>{
  const s=served();
  assert.match(s,/pxl-urg-0010-wo-autonumber\.js\?v=PXL-URG-0133/);
  assert.match(s,/pxl-urg-0040-master-pricelist-menu\.js\?v=PXL-URG-0132/);
  assert.match(s,/pxl-urg-0121-pr-live-load\.js/);
  assert.match(s,/Teknisi 1 \(opsional\)\.\.\./);
  assert.doesNotMatch(s,/Wajib memilih minimal 1 teknisi\./);
  assert.match(s,/await window\.PXL_URG_0010\?\.ensure\?\.\(\)/);
  assert.equal((s.match(/\/pxl-urg-0010-wo-autonumber\.js/g)||[]).length,1);
  assert.equal(inject(s),s);
});
test('0133 server generator reads highest WO including archives and previous years',async()=>{
  const year=new Date().getFullYear();
  const value=nextWoNumber([
    {wo_number:'WO-'+year+'-000283',archived:true},
    {wo_number:'WO-'+year+'-000210'},
    {wo_number:'WO-'+(year-1)+'-999999'},
    {wo_number:'WO-'+year+'-000299',archived:true}
  ],year);
  assert.equal(value,'WO-'+year+'-000300');
  const r=runtime({wo_number:value});
  const number=await r.window.PXL_URG_0010.ensure();
  assert.equal(number,'WO-'+year+'-000300');
  assert.equal(r.input.value,number);
  assert.equal(r.input.readOnly,true);
  assert.equal(r.hits(),1);
  const backend=read('pxl-urg-0133-wo-number-api.js');
  assert.match(backend,/db\.getTickets\(null,true\)/);
  assert.match(backend,/previousGet\.call\(this,'\/api\/tickets\/next-number',\.\.\.auth,/);
});
test('0133 combines concurrent auto-number requests to one live fetch',async()=>{
  const year=new Date().getFullYear();
  const r=runtime({wo_number:'WO-'+year+'-000102'},{wait:true});
  const a=r.window.PXL_URG_0010.ensure(),b=r.window.PXL_URG_0010.ensure();
  assert.equal(r.hits(),1);
  r.release();
  assert.equal(await a,'WO-'+year+'-000102');
  assert.equal(await b,'WO-'+year+'-000102');
});
test('0133 fails closed if ticket list unauthorized (no fake WO numbers)',async()=>{
  const r=runtime([],{ok:false});
  assert.equal(await r.window.PXL_URG_0010.ensure(),'');
  assert.equal(r.input.value,'');
});
test('0133 Submit awaits generated WO and allows zero technicians',async()=>{
  const s=served(),i=s.indexOf('async function saveReport(){'),j=s.indexOf('\nasync function updateStatus(',i);
  assert(i>0&&j>i);
  const values={'f-wo':'','f-time':'2026-11-06T15:00','f-assign-tech':'','f-assign-tech2':'','f-work-order-type':'Survey','f-google-maps-url':'','f-project':'test','f-customer':'test','f-customer-phone':'','f-desc':''};
  const elements=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:v}]));
  elements['btn-save']={disabled:false,textContent:'Submit'};
  const calls=[],alerts=[],rows=[];
  const expected='WO-2026-000456';
  const env={
    window:{PXL_URG_0010:{ensure:async()=>expected,refresh:()=>{}}},
    document:{getElementById:id=>elements[id]},
    currentUser:{role:'manager'},showAlert:(...args)=>alerts.push(args),
    api:async(method,url,payload)=>{calls.push({method,url,payload});return{id:'mock-ticket-uuid'}},
    allTickets:rows,gpsCache:null,currentRating:0,
    clearForm:()=>{},renderKPI:()=>{},renderTickets:()=>{},
    setTimeout:()=>{},console
  };
  await vm.runInNewContext('('+s.slice(i,j)+')',env)();
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/tickets');
  assert.equal(calls[0].payload.wo_number,expected);
  assert.equal(calls[0].payload.assigned_to,'');
  assert.equal(calls[0].payload.status,'assigned');
  assert.equal(alerts[0][0],'success');
});

test('0133 retries exactly once after a duplicate-number conflict without removing optional technician',async()=>{
  const s=served(),i=s.indexOf('async function saveReport(){'),j=s.indexOf('\nasync function updateStatus(',i);
  const values={'f-wo':'','f-time':'2026-11-06T15:00','f-assign-tech':'','f-assign-tech2':'','f-work-order-type':'Operasional','f-google-maps-url':'','f-project':'Test','f-customer':'Test','f-customer-phone':'','f-desc':''};
  const elements=Object.fromEntries(Object.entries(values).map(([id,value])=>[id,{value}]));
  elements['btn-save']={disabled:false,textContent:'Submit'};
  const sent=[],alerts=[];
  let latest=0;
  const env={
    window:{PXL_URG_0010:{ensure:async()=>++latest===1?'WO-2026-000200':'WO-2026-000201',refresh:()=>{}}},
    document:{getElementById:id=>elements[id]},currentUser:{role:'manager'},
    api:async(method,url,payload)=>{
      sent.push(payload.wo_number);
      if(sent.length===1)throw Error('Nomor WO sudah pernah digunakan dan tidak boleh dipakai ulang.');
      return {id:'mock-success'};
    },
    showAlert:(...args)=>alerts.push(args),allTickets:[],gpsCache:null,currentRating:0,
    clearForm:()=>{},renderKPI:()=>{},renderTickets:()=>{},setTimeout:()=>{},console
  };
  await vm.runInNewContext('('+s.slice(i,j)+')',env)();
  assert.deepEqual(sent,['WO-2026-000200','WO-2026-000201']);
  assert.equal(alerts[0][0],'success');
});

test('0133 read-only route requires authentication and includes archived WO numbers',async()=>{
  const express=require('express');
  const app=express();
  const year=new Date(Date.now()+8*3600e3).getUTCFullYear();
  const dbKey=require.resolve('../db');
  const old=require.cache[dbKey];
  let dbCalls=0;
  require.cache[dbKey]={id:dbKey,filename:dbKey,loaded:true,exports:{
    getTickets:async(filter,includeArchived)=>{dbCalls++;assert.equal(filter,null);assert.equal(includeArchived,true);return[
      {wo_number:'WO-'+year+'-000321',archived:false},
      {wo_number:'WO-'+year+'-000500',archived:true}
    ]}
  }};
  const auth=(req,res,next)=>req.headers.authorization==='Bearer test'?next():res.status(401).json({error:'Unauthorized'});
  app.get('/api/tickets',auth,(_req,res)=>res.json([]));
  const server=await new Promise(resolve=>{
    const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));
  });
  const url='http://127.0.0.1:'+server.address().port+'/api/tickets/next-number';
  try{
    const anon=await fetch(url);
    assert.equal(anon.status,401);
    assert.equal(dbCalls,0);
    const allowed=await fetch(url,{headers:{Authorization:'Bearer test'}});
    assert.equal(allowed.status,200);
    assert.deepEqual(await allowed.json(),{wo_number:'WO-'+year+'-000501'});
    assert.equal(allowed.headers.get('cache-control'),'no-store, max-age=0');
    assert.equal(dbCalls,1);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    if(old)require.cache[dbKey]=old;else delete require.cache[dbKey];
  }
});
