const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-3b-project-mr.js'),'utf8');

function block(a,b){const s=src.indexOf(a);assert.notEqual(s,-1,`missing ${a}`);const e=src.indexOf(b,s+a.length);return src.slice(s,e<0?src.length:e)}

test('submitted Superadmin/Manager/Admin approval view is read-only and exposes approve/reject only',()=>{
  assert.match(src,/canApprove/);
  assert.match(src,/\['superadmin','manager','admin'\]\.includes|\['manager','admin','superadmin'\]\.includes/);
  assert.match(src,/Approve/);assert.match(src,/Reject/);
  assert.match(src,/reject.*reason|reason.*reject/is);
  assert.match(src,/\/approve/);assert.match(src,/\/reject/);
  const approval=block('function renderApproval','function renderAudit');
  assert.doesNotMatch(approval,/data-v3b-qty|\/movements|\/finalize/);
});

test('approved and legacy issued/final are read-only released material states',()=>{
  assert.match(src,/\['approved','issued','final'\]/);
  assert.match(src,/Qty Approved/);
  assert.match(src,/Material approved\/released for Project/i);
  assert.match(src,/Input Today/);
});

test('Phase 3C browser contains no movement permission or action controls',()=>{
  assert.doesNotMatch(src,/material_request_issue|material_request_edit|canTake|canReturnUse|canFinalize/);
  assert.doesNotMatch(src,/data-v3b-move|\/movements|\/finalize|pendingMovement|idempotency_key/);
});

test('historical movement rows remain renderable only inside audit history',()=>{
  const audit=block('function renderAudit','async function approveMr');
  assert.match(audit,/mr\?\.movements|mr\.movements/);
  assert.match(audit,/movement_type/);
  assert.match(audit,/History MR Project/);
  assert.doesNotMatch(audit,/button[^>]*move|onclick[^\n]*movement/i);
});

test('browser never calculates or mutates Inventory stock locally',()=>{
  assert.doesNotMatch(src,/stock\s*[+\-]=|stock\s*=\s*stock\s*[+\-]/);
  assert.doesNotMatch(src,/getInventory|inventory_items|inventory_item_id/);
});

test('active finalization is absent while legacy final status stays readable',()=>{
  assert.match(src,/final:'Approved \(Legacy\)'/);
  assert.doesNotMatch(src,/canFinalize|Final MR Project|\/finalize/);
});

test('API errors are surfaced without blind retry',()=>{
  assert.match(src,/alert\(e\.message/);
  assert.doesNotMatch(src,/catch\([^)]*\)\s*\{[^}]*request\([^}]*request\(/is);
});
