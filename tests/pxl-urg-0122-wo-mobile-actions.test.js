const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('WO mobile keeps card structure, wraps only actions, and guarantees Detail loader',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0122-wo-mobile-actions.js'),'utf8');
  assert.match(src,/max-width:\s*700px/);
  assert.match(src,/\.ticket-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.doesNotMatch(src,/\.ticket-header\s*\{/);
  assert.doesNotMatch(src,/flex-direction:\s*column/);
  assert.match(src,/pxl-urg-0038-ticket-detail-modal\.js/);
  assert.match(src,/PXL_URG_0038.*refresh/s);
});

test('0122 does not reference PR or Project loaders',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0122-wo-mobile-actions.js'),'utf8');
  assert.doesNotMatch(src,/loadPurchaseRequests|loadProjects|project-report-summaries|prData|projectsData/);
});

test('0122 hook injects only the WO mobile UI asset',()=>{
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0122-wo-mobile-actions-hook.js'),'utf8');
  const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
  assert.match(hook,/pxl-urg-0122-wo-mobile-actions\.js\?v=PXL-URG-0122/);
  assert.doesNotMatch(hook,/purchase-requests|project-report-summaries|loadProjects/);
  assert.match(config,/require\('\.\/pxl-urg-0122-wo-mobile-actions-hook'\)/);
});