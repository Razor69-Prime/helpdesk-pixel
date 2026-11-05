'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');

test('DM 0003 adds dashboard loader without duplicating existing module loader',()=>{
  const {injectLoader}=require(path.join(root,'pxl-dm-0001-api.js'));
  const page='<html><body>PixelApps</body></html>';
  const injected=injectLoader(page);
  assert.match(injected,/pxl-dm-0001\.js\?v=PXL-DM-0002/);
  assert.match(injected,/pxl-dm-0003-dashboard\.js\?v=PXL-DM-0003/);
  assert.equal((injected.match(/pxl-dm-0003-dashboard\.js/g)||[]).length,1);
  assert.equal(injectLoader(injected),injected);
  const existing='<html><body><script src="/pxl-dm-0001.js?v=PXL-DM-0002"></script></body></html>';
  const upgraded=injectLoader(existing);
  assert.equal((upgraded.match(/pxl-dm-0001\.js/g)||[]).length,1);
  assert.equal((upgraded.match(/pxl-dm-0003-dashboard\.js/g)||[]).length,1);
});

test('DM 0003 places submenu between CRM and Project without editing index.html',()=>{
  const src=read('public/pxl-dm-0003-dashboard.js');
  assert.match(src,/getElementById\('dsub-crm'\)/);
  assert.match(src,/getElementById\('dsub-project'\)/);
  assert.match(src,/crm\.parentNode\.insertBefore\(button,project\)/);
  assert.match(src,/window\.switchDashSub\('digital-marketing',button\)/);
  assert.match(src,/panel\.style\.display='none'/);
});

test('DM 0003 preserves Superadmin permission and uses read-only existing snapshot API',()=>{
  const src=read('public/pxl-dm-0003-dashboard.js');
  assert.match(src,/role\(\)!=='superadmin'/);
  assert.match(src,/api\/digital-marketing\/snapshots/);
  assert.match(src,/method:'GET'/);
  assert.doesNotMatch(src,/method:'POST'|\/api\/digital-marketing\/pull|\/api\/digital-marketing\/backfill/);
  assert.match(src,/data-pxl-dm/);
});

test('DM 0003 shows existing KPI categories without introducing new data source',()=>{
  const src=read('public/pxl-dm-0003-dashboard.js');
  for(const key of ['meta_ads','prospect','target_achievement','categories','comparison','website','TikTok','Instagram','Buka Modul Lengkap'])assert.ok(src.includes(key),key);
  assert.doesNotMatch(src,/api\/ai\//);
});

test('DM 0003 renders after CRM for Superadmin and hides when another dashboard tab is clicked',async()=>{
  const vm=require('node:vm');
  const source=read('public/pxl-dm-0003-dashboard.js');
  const map=new Map();
  class El{
    constructor(id=''){this.id=id;this.children=[];this.parentNode=null;this.listeners={};this.style={};this.dataset={};this.innerHTML='';this.textContent='';}
    insertBefore(node,next){const i=this.children.indexOf(next);this.children.splice(i<0?this.children.length:i,0,node);node.parentNode=this;if(node.id)map.set(node.id,node);return node;}
    appendChild(node){return this.insertBefore(node,null);}
    addEventListener(name,listener){(this.listeners[name]??=[]).push(listener);}
    querySelector(){return new El('stub');}
  }
  const bar=new El(), parent=new El(), head=new El();
  const crm=new El('dsub-crm'),project=new El('dsub-project'),crmPanel=new El('dash-sec-crm');
  bar.appendChild(crm);bar.appendChild(project);parent.appendChild(crmPanel);
  map.set(crm.id,crm);map.set(project.id,project);map.set(crmPanel.id,crmPanel);
  const calls=[];
  const doc={readyState:'complete',head,getElementById:id=>map.get(id),createElement:()=>new El(),addEventListener:()=>{}};
  const window={currentUser:{role:'superadmin'},__pxlAuthToken:'test-token',switchDashSub:(sub,button)=>calls.push([sub,button.id])};
  const sandbox={document:doc,window,localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},
    setInterval:()=>1,clearInterval:()=>{},fetch:async()=>({ok:true,json:async()=>[]})};
  vm.runInNewContext(source,sandbox);
  const button=map.get('dsub-digital-marketing'),panel=map.get('dash-sec-digital-marketing');
  assert.ok(button);assert.ok(panel);
  assert.deepEqual(bar.children.map(child=>child.id),['dsub-crm','dsub-digital-marketing','dsub-project']);
  button.listeners.click[0]();
  assert.deepEqual(calls,[['digital-marketing','dsub-digital-marketing']]);
  assert.equal(panel.style.display,'');
  bar.listeners.click[0]({target:{closest:()=>project}});
  assert.equal(panel.style.display,'none');
});

test('DM 0003 does not expose a submenu to Manager',()=>{
  const vm=require('node:vm'),source=read('public/pxl-dm-0003-dashboard.js');
  const doc={readyState:'complete',getElementById:()=>({parentNode:{insertBefore:()=>{throw Error('Not allowed')}}}),addEventListener:()=>{}};
  let mounted=false;
  vm.runInNewContext(source,{document:doc,window:{currentUser:{role:'manager'}},setInterval:()=>{mounted=true;return 1},clearInterval:()=>{}});
  assert.equal(mounted,true); // Only temporary retry; no dashboard mutation.
});
