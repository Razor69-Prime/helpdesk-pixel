const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-3b-project-mr.js'),'utf8');

test('submitted Manager/Admin approval view is read-only and exposes only approve/reject state actions',()=>{
  assert.match(src,/canApprove/);
  assert.match(src,/\['manager','admin'\]\.includes/);
  assert.match(src,/Approve/);assert.match(src,/Reject/);
  assert.match(src,/reject.*reason|reason.*reject/is);
  assert.match(src,/\/approve/);assert.match(src,/\/reject/);
  const approvalBlock=src.slice(src.indexOf('function renderApproval'),src.indexOf('function renderLifecycle'));
  assert.doesNotMatch(approvalBlock,/\/movements/);
  assert.doesNotMatch(approvalBlock,/qty_requested.*input|data-v3b-qty/);
});

test('Approved/Issued lifecycle shows requested taken returned used outstanding',()=>{
  for(const label of ['Requested','Taken','Returned','Used','Outstanding'])assert.match(src,new RegExp(label));
  assert.match(src,/status==='approved'|status === 'approved'/);
  assert.match(src,/status==='issued'|status === 'issued'/);
});

test('Take permission uses material_request_issue and Return/Use uses requester or material_request_edit',()=>{
  assert.match(src,/material_request_issue/);
  assert.match(src,/material_request_edit/);
  assert.match(src,/created_by_user_id/);
  assert.match(src,/canTake/);assert.match(src,/canReturnUse/);
});

test('movement operation uses one idempotency key and disables duplicate submit while pending',()=>{
  assert.match(src,/crypto\.randomUUID\(\)/);
  assert.match(src,/idempotency_key/);
  assert.match(src,/pendingMovement/);
  assert.match(src,/disabled\s*=\s*true|state\.busy/);
  assert.match(src,/\/movements/);
});

test('movement refreshes server state and never calculates Inventory stock locally',()=>{
  assert.match(src,/material_request/);
  assert.match(src,/loadDetail\(state\.requestId\)|state\.detail=.*material_request/);
  assert.doesNotMatch(src,/stock\s*[+\-]=|stock\s*=\s*stock\s*[+\-]/);
});

test('Final is visible only for issued with all server outstanding zero',()=>{
  assert.match(src,/canFinalize/);
  assert.match(src,/qty_outstanding/);
  assert.match(src,/every\([^)]*=>\s*Number\([^)]*qty_outstanding/);
  assert.match(src,/\/finalize/);
});

test('serial movement errors are surfaced without blind auto retry',()=>{
  assert.match(src,/alert\(e\.message|showError/);
  assert.doesNotMatch(src,/catch\([^)]*\)\s*\{[^}]*movement[^}]*movement/is);
});
