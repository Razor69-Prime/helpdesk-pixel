const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0125 restores Kanban+Timeline scripts and native Edit Tanggal button into served WO HTML',()=>{
  const mod=require(path.join(root,'pxl-urg-0125-wo-menu-date-sync.js'));
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const out=mod.patchWoMenuDateSync(html);
  assert.match(out,/pxl-stg-0007j-layout\.js\?v=PXL-URG-0125/);
  assert.match(out,/pxl-stg-0007l-timeline\.js\?v=PXL-URG-0125/);
  assert.match(out,/pxl-urg-0125-wo-date-sync\.js\?v=PXL-URG-0125/);
  assert.match(out,/const dateEditBtn=.*pxlEditWoSchedule/s);
  assert.match(out,/🕐 \$\{dt\}\$\{dateEditBtn\}/);
  assert.equal(mod.patchWoMenuDateSync(out),out);
});

test('0125 date editor writes to canonical Kanban schedule endpoint and has no startup observer/timer',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0125-wo-date-sync.js'),'utf8');
  assert.match(src,/\/api\/technician-kanban\/.*\/schedule/);
  assert.match(src,/source:'ticket_list'/);
  assert.match(src,/scheduled_date/);
  assert.match(src,/scheduled_start_time/);
  assert.doesNotMatch(src,/MutationObserver|setInterval|setTimeout/);
  assert.doesNotMatch(src,/loadPurchaseRequests|loadProjects|project-report-summaries/);
});

test('0121 stable hook applies 0123 detail, 0124 mobile grid, then 0125 WO recovery',()=>{
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0121-pr-live-load-hook.js'),'utf8');
  assert.match(hook,/pxl-urg-0125-wo-menu-date-sync/);
  assert.match(hook,/patchWoMenuDateSync\(patchWoMobileGrid\(patchWoDetail\(/);
});
