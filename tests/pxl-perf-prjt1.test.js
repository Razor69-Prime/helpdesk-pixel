const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('PR list override is compact and excludes signature blobs',()=>{
  const src=read('db.js');
  const m=src.match(/async function getPurchaseRequests\(\)[\s\S]*?\n}/);
  assert.ok(m,'db.js must override getPurchaseRequests');
  assert.match(m[0],/purchase_requests\?select=id,pr_number,pr_date,outlet,requester,requester_title,department,reason,remarks,items,status/);
  assert.doesNotMatch(m[0],/approver_signature|approver1_signature|requester_signature/);
  assert.match(src,/async function getPurchaseRequest\(id\)/);
  assert.match(src,/getPurchaseRequests,\s*getPurchaseRequest/);
});

test('PR detail performance API is installed with the same PR roles',()=>{
  const api=read('pxl-perf-prjt1-api.js');
  assert.match(api,/superadmin/);assert.match(api,/manager/);assert.match(api,/accounting/);assert.match(api,/admin/);
  assert.match(api,/app\.get\('\/api\/purchase-requests\/:id'/);
  assert.match(api,/db\.getPurchaseRequest\(req\.params\.id\)/);
  const loader=read('pxl-stg-0009a-leave-api.js');
  assert.match(loader,/pxl-perf-prjt1-api/);
});

test('Project Tracker renders warmed project cache before normal refresh',()=>{
  const src=read('public/pxl-stg-0020b-uat-fix.js');
  assert.match(src,/PXL-PERF-PRJT1/);
  assert.match(src,/window\.loadProjects=async function/);
  assert.match(src,/dashProjectData/);
  assert.match(src,/renderProjectList\(\)/);
  assert.match(src,/originalLoadProjects\.apply/);
});

test('locked PR PDF renderer fetches full PR only when exporting',()=>{
  const src=read('public/pxl-urg-0031-pr-pdf-branding.js');
  const start=src.indexOf('async function directExportPRPDF(id)');
  assert.ok(start>=0);
  const block=src.slice(start,start+1800);
  assert.match(block,/api\('GET','\/purchase-requests\/'\+encodeURIComponent\(id\)\)/);
  assert.match(block,/prData\[idx\]=full/);
});
