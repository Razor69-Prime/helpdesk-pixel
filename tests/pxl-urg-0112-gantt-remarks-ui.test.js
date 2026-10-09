const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const gantt=read('public/pxl-vnext-3a-project-detail.js');
const index=read('public/index.html');
const remarksPatch=read('public/pxl-urg-0032a-remarks-button-fix.js');
const wrapper=read('pxl-stg-0004f.js');

test('Project Detail backdrop is drag/select-safe and does not close from a dragged Gantt input',()=>{
  assert.doesNotMatch(gantt,/addEventListener\('click',[^\n]*pxl-v3a-modal[^\n]*close\(\)/);
  assert.match(gantt,/pointerdown/);
  assert.match(gantt,/pointermove/);
  assert.match(gantt,/pointerup/);
  assert.match(gantt,/pointercancel/);
  assert.match(gantt,/Math\.hypot\([^)]*\)>6/);
  assert.match(gantt,/e\.target===modal/);
});

test('WO remarks are compact by default and expose Lihat Selengkapnya only when needed',()=>{
  assert.match(index,/\.pxl-remarks-wrap\.is-collapsed \.pxl-remarks-content\{max-height:/);
  assert.match(index,/function pxlFormatWoRemarks\(/);
  assert.match(index,/function pxlRefreshWoRemarksToggles\(/);
  assert.match(index,/function pxlToggleWoRemarks\(/);
  assert.match(index,/Lihat Selengkapnya/);
  assert.match(index,/pxlFormatWoRemarks\(technicianRemarks,true\)/);
  assert.match(index,/pxlRefreshWoRemarksToggles\(el\)/);
});

test('legacy native remarks compatibility patch preserves compact markup instead of flattening full text',()=>{
  assert.match(remarksPatch,/pxlFormatWoRemarks/);
  assert.match(remarksPatch,/dataset\.pxlRemarksValue/);
  assert.doesNotMatch(remarksPatch,/if\(el\.textContent!==nextText\)el\.textContent=nextText/);
  assert.match(remarksPatch,/pxlRefreshWoRemarksToggles/);
});

test('0112 cache-busts both Project Detail and injected remarks compatibility script',()=>{
  assert.match(index,/pxl-vnext-3a-project-detail\.js\?v=PXL-URG-0112/);
  assert.match(wrapper,/pxl-urg-0032a-remarks-button-fix\.js\?v=PXL-URG-0112/);
});
