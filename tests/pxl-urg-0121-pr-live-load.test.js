const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('PR live loader bypasses shared api cache, keeps existing rows on transient failure, and does not touch Project',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0121-pr-live-load.js'),'utf8');
  assert.match(src,/fetch\('\/api\/purchase-requests\?_pxl0121='/);
  assert.match(src,/cache:'no-store'/);
  assert.match(src,/window\.loadPurchaseRequests/);
  assert.doesNotMatch(src,/prData=\[\]/);
  assert.doesNotMatch(src,/loadProjects|projectsData|project-report-summaries/);
});

test('0121 hook is isolated and config loads it without changing 0119 or 0120 Project code',()=>{
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0121-pr-live-load-hook.js'),'utf8');
  const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
  assert.match(hook,/pxl-urg-0121-pr-live-load\.js\?v=PXL-URG-0121/);
  assert.doesNotMatch(hook,/loadProjects|projectsData|project-report-summaries/);
  assert.match(config,/require\('\.\/pxl-urg-0121-pr-live-load-hook'\)/);
});