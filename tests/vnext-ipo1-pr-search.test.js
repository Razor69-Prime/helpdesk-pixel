const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const db=fs.readFileSync(path.join(__dirname,'..','db.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-internal-po.js'),'utf8');

test('Internal PO PR search matches the same searchable PR content as the main PR menu',()=>{
  const m=db.match(/async function searchProjectInternalPoPurchaseRequests[\s\S]*?\n}\n/);
  assert.ok(m,'searchProjectInternalPoPurchaseRequests must exist');
  const body=m[0];
  assert.match(body,/getPurchaseRequests\(\)/,'picker must reuse the compact PR payload used by the main PR menu');
  assert.match(body,/JSON\.stringify\(row\).*includes/,'picker search must cover reason, remarks, item descriptions and other compact PR fields');
  assert.match(body,/slice\(0,capped\)/,'result count must remain bounded');
});


test('Internal PO PR picker displays PR reason or remarks instead of the first item name',()=>{
  assert.match(ui,/const summary=String\(pr\.reason\?\?pr\.remarks\?\?''\)/,'PR reason/remarks must drive the visible title');
  assert.match(ui,/\$\{h\(summary\)\}/,'visible PR card must render the PR summary');
  assert.match(ui,/Cari nomor PR, keterangan, requester, atau outlet/,'search hint must explain that PR description is searchable');
});
