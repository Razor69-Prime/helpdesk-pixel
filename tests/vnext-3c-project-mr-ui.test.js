const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const detail=fs.readFileSync(path.join(root,'public/pxl-vnext-3a-project-detail.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');

test('Project MR browser revision is current 3D1 hotfix and cache is bumped',()=>{
  assert.match(ui,/PXL-VNEXT-3D4/);
  assert.match(ui,/const REV='PXL-VNEXT-3D4'/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D4/);
  assert.match(sw,/pixelapps-inv1-v121/);
});

test('Draft and Rejected editor supports BOQ or manual material without Inventory flow',()=>{
  assert.match(ui,/data-v3b-material-search/);
  assert.match(ui,/Cari BOQ atau ketik material manual/);
  assert.match(ui,/＋ Tambah Item/);
  assert.match(ui,/source_type:'manual'/);
  assert.match(ui,/Qty Requested/);
  assert.doesNotMatch(ui,/Tambah dari BOQ Project|Tambah Item Manual/);
  assert.doesNotMatch(ui,/inventory_extra|Tambah Material di Luar BOQ|data-v3b-inv=|Pilih Inventory/);
});

test('active MR UI has no Take Return Use outstanding or finalize controls and endpoints',()=>{
  for(const pattern of [
    /function canTake/,
    /function canReturnUse/,
    /function canFinalize/,
    /function applyMovement/,
    /function finalizeMr/,
    /takeInventorySelections/,
    /data-v3b-move/,
    /data-v3b-take-inventory-search/,
    /\/movements`/,
    /\/finalize`/,
    /<th>Taken<\/th>/,
    /<th>Returned<\/th>/,
    /<th>Used<\/th>/,
    /<th>Outstanding<\/th>/,
    />Take<\/button>/,
    />Return<\/button>/,
    />Use<\/button>/,
    /Final MR Project/
  ]) assert.doesNotMatch(ui,pattern);
});

test('Submitted keeps immutable Approve Reject and approved-like states show released quantity read-only',()=>{
  assert.match(ui,/function canApprove/);
  assert.match(ui,/Approval MR Project/);
  assert.match(ui,/>Approve<\/button>/);
  assert.match(ui,/>Reject<\/button>/);
  assert.match(ui,/Qty Approved/);
  assert.match(ui,/Material approved\/released for Project/i);
  assert.match(ui,/\['approved','issued','final'\]/);
  assert.match(ui,/Input Today/);
});

test('legacy issued/final remain readable via audit only, without movement action binding',()=>{
  assert.match(ui,/issued/);
  assert.match(ui,/final/);
  assert.match(ui,/renderAudit/);
  assert.doesNotMatch(ui,/bindLifecycle|movementButtons|renderLifecycle/);
});

test('Project Detail helper describes approval/release flow without pickup return outstanding copy',()=>{
  assert.match(detail,/Material Request Project/);
  assert.match(detail,/approval|approved|persetujuan/i);
  assert.doesNotMatch(detail,/pengambilan|pengembalian|outstanding/i);
});
