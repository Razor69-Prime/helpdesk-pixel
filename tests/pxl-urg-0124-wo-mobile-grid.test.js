const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0124 injects mobile-only WO action grid matching compact reference',()=>{
  const mod=require(path.join(root,'pxl-urg-0124-wo-mobile-grid.js'));
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const out=mod.patchWoMobileGrid(html);
  assert.match(out,/PXL-URG-0124 — WO mobile action grid/);
  assert.match(out,/@media\s*\(max-width:\s*600px\)/);
  assert.match(out,/#tab-tickets\s+\.ticket-header\s*\{[^}]*display:block/s);
  assert.match(out,/#tab-tickets\s+\.ticket-actions\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s);
  assert.match(out,/#tab-tickets\s+\.ticket-actions\s+\.status-select\s*\{[^}]*grid-column:1\/-1/s);
  assert.match(out,/#tab-tickets\s+\.ticket-actions\s+\.btn\s*\{[^}]*width:100%/s);
});

test('0124 is idempotent and has no browser observers, timers, login, PR or Project logic',()=>{
  const mod=require(path.join(root,'pxl-urg-0124-wo-mobile-grid.js'));
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const once=mod.patchWoMobileGrid(html);
  assert.equal(mod.patchWoMobileGrid(once),once);
  const src=fs.readFileSync(path.join(root,'pxl-urg-0124-wo-mobile-grid.js'),'utf8');
  assert.doesNotMatch(src,/MutationObserver|setInterval|setTimeout|login-screen|loadPurchaseRequests|loadProjects|project-report-summaries/);
});

test('0121 stable HTML hook applies 0123 detail then 0124 mobile grid',()=>{
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0121-pr-live-load-hook.js'),'utf8');
  assert.match(hook,/pxl-urg-0124-wo-mobile-grid/);
  assert.match(hook,/patchWoMobileGrid\(patchWoDetail\(/);
});
