const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0123 server patch inserts native Detail button with click-only lazy loader',()=>{
  const mod=require(path.join(root,'pxl-urg-0123-wo-detail-safe.js'));
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const out=mod.patchWoDetail(html);
  assert.match(out,/const detailBtn=.*🔎 Detail/s);
  assert.match(out,/pxl-urg-0038-ticket-detail-modal\.js\?v=PXL-URG-0123/);
  assert.match(out,/\$\{photoBtn\}\s*\$\{detailBtn\}/);
});

test('0123 patch is idempotent and contains no browser polling/observer',()=>{
  const mod=require(path.join(root,'pxl-urg-0123-wo-detail-safe.js'));
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const once=mod.patchWoDetail(html);
  const twice=mod.patchWoDetail(once);
  assert.equal(twice,once);
  const src=fs.readFileSync(path.join(root,'pxl-urg-0123-wo-detail-safe.js'),'utf8');
  assert.doesNotMatch(src,/MutationObserver|setInterval|setTimeout|loadPurchaseRequests|loadProjects|project-report-summaries/);
});

test('0121 stable static loader applies 0123 patch before serving index',()=>{
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0121-pr-live-load-hook.js'),'utf8');
  assert.match(hook,/pxl-urg-0123-wo-detail-safe/);
  assert.match(hook,/patchWoDetail/);
});
