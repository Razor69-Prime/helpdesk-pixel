const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('0126 injects isolated Kanban unhide guard after native Kanban scripts',()=>{
  const menu=fs.readFileSync(path.join(root,'pxl-urg-0125-wo-menu-date-sync.js'),'utf8');
  assert.match(menu,/pxl-urg-0126-kanban-unhide\.js\?v=PXL-URG-0126/);
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0126-kanban-unhide.js'),'utf8');
  assert.match(src,/closest\?\.\('\[data-k7-nav\]'\)/);
  assert.match(src,/page\.hidden=false/);
  assert.match(src,/page\.style\.display='block'/);
});

test('0126 guard has no observer timer API or business-flow changes',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0126-kanban-unhide.js'),'utf8');
  assert.doesNotMatch(src,/MutationObserver|setInterval|setTimeout|fetch\(|\/api\/|loadProjects|loadPurchaseRequests/);
});
