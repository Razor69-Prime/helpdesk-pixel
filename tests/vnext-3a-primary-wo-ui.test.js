const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-3a-project-detail.js'),'utf8');

test('Primary WO controls are permission-gated while read-only relation remains visible',()=>{
  assert.match(src,/hasPermission\('project_primary_wo_manage'\)/);
  assert.match(src,/Primary WO/);
  assert.match(src,/Pilih\/Ganti Primary WO/);
  assert.match(src,/Lepas Primary WO/);
});

test('Primary WO search uses compact existing WO endpoint and renders identifying fields',()=>{
  assert.match(src,/\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/work-order-options\?q=/);
  for(const field of ['wo_number','customer_name','project_name','status','work_order_type']) assert.match(src,new RegExp(field));
});

test('link and unlink use Phase 3A APIs only and refresh authoritative Project Detail',()=>{
  assert.match(src,/api\('PUT',`\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/primary-work-order`,\{ticket_id:/);
  assert.match(src,/api\('DELETE',`\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/primary-work-order`\)/);
  assert.match(src,/await refresh\(\)/);
  assert.doesNotMatch(src,/api\('POST',[^\n]*work-order/,'Primary WO UI must not create WO');
});

test('unlink requires explicit confirmation and unavailable linked WO is handled safely',()=>{
  assert.match(src,/confirm\([^\n]*Primary WO/);
  assert.match(src,/unavailable/);
  assert.match(src,/WO tidak tersedia/);
});

test('open existing WO reuses Daftar Tiket search instead of duplicating WO detail',()=>{
  assert.match(src,/data-tab-id="tickets"/);
  assert.match(src,/switchTab\('tickets'/);
  assert.match(src,/getElementById\('t-search'\)/);
  assert.match(src,/resetTicketListPage/);
  assert.match(src,/Buka di Daftar WO/);
});
