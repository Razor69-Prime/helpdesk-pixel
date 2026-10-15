const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-internal-po.js'),'utf8');

test('Internal PO table keeps row numbering separate from delete action',()=>{
  assert.match(ui,/pxl-ipo-row-no/,'row number needs a dedicated layout wrapper');
  assert.match(ui,/pxl-ipo-delete/,'delete action needs its own stable control class');
});

test('Internal PO item names get a readable dedicated column width',()=>{
  assert.match(ui,/pxl-ipo-item-name/,'item name input needs a dedicated class');
  assert.match(ui,/\.pxl-ipo-table th:nth-child\(2\)[^{]*\{[^}]*min-width:\s*260px/,'item-name column must have a readable minimum width');
  assert.match(ui,/\.pxl-ipo-item-name\{[^}]*width:\s*100%/,'item-name input should fill its column');
});
