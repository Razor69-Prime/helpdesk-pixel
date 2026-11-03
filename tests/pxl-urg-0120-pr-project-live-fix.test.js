const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('PR list shape preserves old renderer semantics with much smaller items',()=>{
  const mod=require('../pxl-urg-0120-pr-project-live-fix');
  const rows=mod.compactPrForLegacyRenderer([{id:'p1',items:[
    {desc:'Camera Hikvision',qty:2,price:100,inventory_status:'pending_registration',supplier_phone:'x'},
    {desc:'NVR',qty:1,price:300,inventory_status:'linked',supplier_phone:'y'},
    {desc:'Kabel',qty:5,price:20,inventory_status:'pending_registration',supplier_phone:'z'}
  ]}]);
  const p=rows[0];
  assert.equal(p.items.length,3);
  assert.equal(p.items.reduce((s,i)=>s+(Number(i.qty||0)*Number(i.price||0)),0),600);
  assert.equal(p.items.filter(i=>i.inventory_status==='pending_registration').length,2);
  assert.match(JSON.stringify(p).toLowerCase(),/camera hikvision/);
  assert.match(JSON.stringify(p).toLowerCase(),/nvr/);
  assert.equal(p.items.some(i=>Object.hasOwn(i,'supplier_phone')),false);
});

test('Project live fix uses direct no-store fetch and never clears projects on transient failure',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0120-pr-project-live-fix.js'),'utf8');
  assert.match(src,/fetch\('\/api'\+path/);
  assert.match(src,/cache:'no-store'/);
  assert.match(src,/window\.loadProjects/);
  assert.doesNotMatch(src,/projectsData=\[\]/);
});

test('0120 stays utility-only while 0119 delegates PR compaction and injects the frontend fix',()=>{
  const helper=fs.readFileSync(path.join(root,'pxl-urg-0120-pr-project-live-fix.js'),'utf8');
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0119-pr-project-performance.js'),'utf8');
  assert.doesNotMatch(helper,/app\.(get|post|patch|put|delete)/i);
  assert.doesNotMatch(helper,/migration|alter table|create table/i);
  assert.match(hook,/compactPrForLegacyRenderer/);
  assert.match(hook,/pxl-urg-0120-pr-project-live-fix\.js\?v=PXL-URG-0120/);
});