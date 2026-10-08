const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

test('Input WO keeps explicit work order type selector for Operasional Survey and Project',()=>{
  assert.match(index,/id="f-work-order-type"/);
  assert.match(index,/value="Operasional"/);
  assert.match(index,/value="Survey"/);
  assert.match(index,/value="Project"/);
  assert.doesNotMatch(index,/value="auto"/);
});

test('manual WO submits explicit selected type while legacy backend classifier remains available',()=>{
  assert.match(index,/work_order_type:selectedWorkOrderType/);
  assert.match(index,/source_type:\s*'manual'/);
  assert.match(server,/MANUAL_WORK_ORDER_TYPES/);
  assert.match(server,/classifyWorkOrderType/);
});

test('legacy privileged override constants remain for non-manual integration fallback',()=>{
  assert.match(server,/WORK_ORDER_TYPE_OVERRIDE_ROLES/);
  assert.match(server,/requestedWorkOrderType/);
  assert.match(server,/WORK_ORDER_TYPES\.includes\(requestedWorkOrderType\)/);
});
