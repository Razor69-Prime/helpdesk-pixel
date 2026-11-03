const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0128 highlights Kanban nav while Kanban is open',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-stg-0007j-layout.js'),'utf8');
  assert.match(src,/function setKanbanActive\(active\)\{\$\$\('\.nav-btn'\)\.forEach\(b=>b\.classList\.remove\('active'\)\);if\(active\)\$\('\[data-k7-nav\]'\)\?\.classList\.add\('active'\);\}/);
  assert.match(src,/openKanban\(\);setKanbanActive\(true\);return;/);
  assert.match(src,/if\(nav\)\{setKanbanActive\(false\);restoreDirectChildren\(\);\}/);
});

test('0128 bumps Kanban asset version only',()=>{
  const src=fs.readFileSync(path.join(root,'pxl-urg-0125-wo-menu-date-sync.js'),'utf8');
  assert.match(src,/pxl-stg-0007j-layout\.js\?v=PXL-URG-0128/);
  assert.match(src,/pxl-stg-0007l-timeline\.js\?v=PXL-URG-0125/);
  assert.match(src,/pxl-urg-0125-wo-date-sync\.js\?v=PXL-URG-0125/);
});
