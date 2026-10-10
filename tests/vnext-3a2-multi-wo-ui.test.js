const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-3a-project-detail.js'),'utf8');

test('Work Order tab renders Primary section and Related WO list',()=>{
  assert.match(src,/Primary WO/);
  assert.match(src,/Related WO/);
  assert.match(src,/state\.data\?\.related_work_orders/);
  assert.match(src,/related\.map/);
});

test('Tambah Related WO is gated by existing project_primary_wo_manage permission',()=>{
  assert.match(src,/hasPermission\('project_primary_wo_manage'\)/);
  assert.match(src,/Tambah Related WO/);
  assert.match(src,/pxl-v3a-related-wo-search/);
});

test('Related search reuses existing compact WO options endpoint and uses distinct add action',()=>{
  assert.match(src,/work-order-options\?q=/);
  assert.match(src,/data-v3a-link-related-wo/);
  assert.match(src,/linkRelatedWorkOrder/);
  assert.doesNotMatch(src,/api\('POST',[^\n]*\/work-order[`'"]/,'Project Detail must not create a WO');
});

test('Related WO opens through existing Daftar WO flow',()=>{
  assert.match(src,/openTicketInList\(/);
  assert.match(src,/data-tab-id="tickets"/);
  assert.match(src,/Buka di Daftar WO/);
});

test('Related unlink warns that WO and history are preserved',()=>{
  assert.match(src,/async function unlinkRelatedWorkOrder\(ticketId\)/);
  assert.match(src,/confirm\([^\n]*(WO|Work Order)[^\n]*(history|riwayat)/i);
  assert.match(src,/api\('DELETE',`\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/related-work-orders\/\$\{encodeURIComponent\(ticketId\)\}`\)/);
});

test('unavailable Related WO renders ticket id and remains unlinkable',()=>{
  assert.match(src,/relatedWo\.unavailable/);
  assert.match(src,/relatedWo\.ticket_id/);
  assert.match(src,/data-v3a-unlink-related/);
});
