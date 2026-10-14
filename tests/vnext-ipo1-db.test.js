const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','db-core.js'),'utf8');

test('db-core imports Internal PO domain helpers and exposes all five adapters',()=>{
  assert.match(src,/require\(['"]\.\/project-internal-po['"]\)/);
  for(const name of ['getProjectInternalPo','getProjectInternalPoHistory','saveProjectInternalPo','searchProjectInternalPoPurchaseRequests','getProjectInternalPoBoqOptions']){
    assert.match(src,new RegExp(`async function ${name}\\b`));
    assert.match(src,new RegExp(`\\b${name}\\b[^\n]*module\.exports|module\.exports[\\s\\S]*\\b${name}\\b`));
  }
});

test('Internal PO read uses dedicated tables active rows history order and atomic RPC',()=>{
  assert.match(src,/\/project_internal_po\?project_id=eq\./);
  assert.match(src,/\/project_internal_po_items\?[^`]*project_id=eq\.[^`]*deleted_at=is\.null[^`]*order=sort_order\.asc,created_at\.asc/);
  assert.match(src,/\/project_internal_po_history\?[^`]*project_id=eq\.[^`]*order=created_at\.desc/);
  assert.match(src,/\/rpc\/pxl_vnext_internal_po_save/);
  assert.match(src,/deriveInternalPoItemStatus/);
  assert.match(src,/deriveInternalPoOverallStatus/);
  assert.match(src,/calculateInternalPoTotals/);
});

test('PR search returns bounded purchase request snapshots including items',()=>{
  assert.match(src,/purchase_requests\?select=id,pr_number,pr_date,outlet,requester,status,items/);
  assert.match(src,/Math\.min\(50/);
  assert.doesNotMatch(src,/searchProjectInternalPoPurchaseRequests[\s\S]{0,900}(?:insertPurchaseRequest|updatePurchaseRequest|deletePurchaseRequest)/);
});

test('BOQ options are current project Material only with no Inventory or Pricelist query',()=>{
  const match=src.match(/async function getProjectInternalPoBoqOptions[\s\S]*?\n}\n/);
  assert.ok(match,'BOQ options adapter must exist');
  const body=match[0];
  assert.match(body,/project_report_items\?/);
  assert.match(body,/project_id=eq\.\$\{encodeURIComponent\(projectId\)\}/);
  assert.match(body,/category=eq\.material/);
  assert.match(body,/item_name/);
  assert.doesNotMatch(body,/inventory|pricelist/i);
});
