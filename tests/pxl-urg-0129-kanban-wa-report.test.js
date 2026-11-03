const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0129 restores old standalone Kanban shell before native Kanban fallback',()=>{
  const hook=fs.readFileSync(path.join(root,'pxl-urg-0125-wo-menu-date-sync.js'),'utf8');
  const shell="/pxl-urg-0008.js?v=PXL-URG-0129";
  const native="/pxl-stg-0007j-layout.js?v=PXL-URG-0128";
  assert.match(hook,/pxl-urg-0008\.js\?v=PXL-URG-0129/);
  assert.ok(hook.indexOf(shell)<hook.indexOf(native),'safe shell must load before native Kanban handler');
});

test('0129 safe shell opens original kanban.html and injects existing Report WA module',()=>{
  const shell=fs.readFileSync(path.join(root,'public/pxl-urg-0008.js'),'utf8');
  assert.match(shell,/openShell\('\/kanban\.html','🗓️ Kanban Teknisi'\)/);
  assert.match(shell,/pathname==='\/kanban\.html'/);
  assert.match(shell,/pxl-urg-0025-kanban-wa-report\.js\?v=PXL-URG-0129/);
});

test('0129 WhatsApp report uses old Kanban controls and approved template',()=>{
  const wa=fs.readFileSync(path.join(root,'public/pxl-urg-0025-kanban-wa-report.js'),'utf8');
  assert.match(wa,/const modes=\$\('\.modes'\)/);
  assert.match(wa,/\$\('#timelineDate'\)/);
  assert.match(wa,/Selamat malam/);
  assert.match(wa,/DEFAULT_TITLE='Schedule Progress PIXEL BADUNG & BANGLI'/);
  assert.match(wa,/\['Selamat malam','Berikut '\+title,dateLabel\(date\)/);
  for(const s of ['No WO :','Project :','Customer :','Teknisi :','TOTAL WO :','PROGRESS TEKNISI','Teknisi Berprogress :','Sisa Teknisi :','Total Teknisi :']) assert.match(wa,new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(wa,/b\.textContent='📋 Report WA'/);
});
