const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0127 uses persistent sidebar delegated click for rebuilt Kanban button',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-stg-0007j-layout.js'),'utf8');
  assert.match(src,/sidebar\.addEventListener\('click',e=>\{const kanban=e\.target\.closest\('\[data-k7-nav\]'\);if\(kanban\)\{e\.preventDefault\(\);e\.stopPropagation\(\);openKanban\(\);setKanbanActive\(true\);return;\}/);
  assert.match(src,/kb\.onclick=null/);
  assert.match(src,/function openKanban\(\)\{const p=\$\('#pxlKanbanPage'\);if\(!p\)return;hideDirectChildren\(p\);p\.hidden=false;p\.style\.display='block';load\(\);\}/);
});

test('0127 bumps Kanban asset version while preserving Timeline and date sync',()=>{
  const src=fs.readFileSync(path.join(root,'pxl-urg-0125-wo-menu-date-sync.js'),'utf8');
  assert.match(src,/pxl-stg-0007j-layout\.js\?v=PXL-URG-0128/);
  assert.match(src,/pxl-stg-0007l-timeline\.js\?v=PXL-URG-0125/);
  assert.match(src,/pxl-urg-0125-wo-date-sync\.js\?v=PXL-URG-0125/);
});
