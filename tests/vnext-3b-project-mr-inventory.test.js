const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'PXL-VNEXT-3B-MIGRATION.sql'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
function functionBlock(name){const start=sql.search(new RegExp(`create or replace function public\\.${name}`,'i'));assert.notEqual(start,-1,`${name} missing`);const next=sql.indexOf('create or replace function public.',start+30);return sql.slice(start,next<0?sql.length:next)}
function route(method,url){const start=server.indexOf(`app.${method}('${url}'`);assert.notEqual(start,-1);const next=server.indexOf('\napp.',start+10);return server.slice(start,next<0?server.length:next)}

test('approval/reject transition never mutates Inventory',()=>{
  const block=functionBlock('pxl_vnext_3b_transition_project_mr');
  assert.doesNotMatch(block,/update\s+public\.inventory_items|insert\s+into\s+public\.inventory_transactions/i);
});

test('take locks stock, checks availability, logs stock and transitions Approved to Issued',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/inventory_items[^;]+for update/is);
  assert.match(block,/stock\s*<\s*v_qty|v_inv\.stock\s*<\s*v_qty/i);
  assert.match(block,/set stock=stock-v_qty/i);
  assert.match(block,/PROJECT_MR_TAKE/);
  assert.match(block,/status='issued'/);
});

test('movement operation is idempotent and repeated key reports already_applied',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/idempotency_key=p_idempotency_key[^;]+for update/is);
  assert.match(block,/already_applied['\"]?\s*,\s*true/i);
  const api=route('post','/api/project-material-requests/:id/movements');
  assert.match(api,/already_applied/);
  assert.match(api,/if\s*\(!?result\?\.already_applied|if\s*\(result\?\.already_applied/s);
});

test('return increases stock and use never changes stock',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/set stock=stock\+v_qty/i);
  assert.match(block,/PROJECT_MR_RETURN/);
  const useBranch=block.slice(block.indexOf("else\n      if v_qty>v_out"));
  assert.match(useBranch,/qty_used=qty_used\+v_qty/);
  assert.doesNotMatch(useBranch,/stock=stock[-+]v_qty/);
});

test('outstanding guards support return use and re-take while net issued cannot exceed requested',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/v_out:=v_item\.qty_taken-v_item\.qty_returned-v_item\.qty_used/);
  assert.match(block,/v_net:=v_item\.qty_taken-v_item\.qty_returned/);
  assert.match(block,/v_net\+v_qty>v_item\.qty_requested/);
  assert.ok((block.match(/v_qty>v_out/g)||[]).length>=2,'return and use must both guard outstanding');
});

test('finalization requires issued status and zero outstanding',()=>{
  const block=functionBlock('pxl_vnext_3b_transition_project_mr');
  assert.match(block,/v_mr\.status<>'issued'/);
  assert.match(block,/sum\(qty_outstanding\)/i);
  assert.match(block,/if v_out>0 then raise exception/i);
});

test('quantity items work but serial physical movement is explicitly rejected',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/tracking_mode[^;]+='serial'/is);
  assert.match(block,/Item serial belum didukung/);
  assert.match(block,/coalesce\(v_inv\.tracking_mode,'quantity'\)/);
});

test('idempotency claim uses conflict-safe insert for simultaneous retries',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/on conflict\s*\(idempotency_key\)\s*do nothing/is);
  assert.match(block,/if v_op\.id is null then[\s\S]*idempotency_key=p_idempotency_key[\s\S]*for update/is);
});

test('reusing idempotency key for a different request or movement is rejected',()=>{
  const block=functionBlock('pxl_vnext_3b_apply_project_mr_movement');
  assert.match(block,/v_op\.project_material_request_id\s*<>\s*p_request_id|v_op\.project_material_request_id\s*!=\s*p_request_id/i);
  assert.match(block,/v_op\.movement_type\s*<>\s*v_type|v_op\.movement_type\s*!=\s*v_type/i);
  assert.match(block,/Idempotency key.*berbeda|idempotency.*different/i);
});
