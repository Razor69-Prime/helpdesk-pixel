const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','db-core.js'),'utf8');

for(const name of ['getProjectRelatedWorkOrders','linkProjectRelatedWorkOrder','unlinkProjectRelatedWorkOrder','getProjectWorkOrderOwner','getProjectLinkedWorkOrderIds']){
  test(`${name} is implemented and exported`,()=>{
    assert.match(src,new RegExp(`async function ${name}\\(`));
    assert.match(src,new RegExp(`\\b${name}\\b[\\s\\S]*module\\.exports|module\\.exports[\\s\\S]*\\b${name}\\b`));
  });
}

test('Related WO helpers use only relation table persistence',()=>{
  const start=src.indexOf('async function getProjectRelatedWorkOrders');
  const end=src.indexOf('async function getProjectGanttTemplates',start);
  const body=src.slice(start,end);
  assert.match(body,/project_related_work_orders/);
  assert.match(body,/project_primary_work_orders/);
  assert.doesNotMatch(body,/updateTicket\(|deleteTicket\(/);
});

test('owner helper normalizes Primary first then Related',()=>{
  const start=src.indexOf('async function getProjectWorkOrderOwner');
  const end=src.indexOf('async function getProjectLinkedWorkOrderIds',start);
  const body=src.slice(start,end);
  assert.match(body,/project_primary_work_orders/);
  assert.match(body,/kind:'primary'/);
  assert.match(body,/project_related_work_orders/);
  assert.match(body,/kind:'related'/);
  assert.ok(body.indexOf('project_primary_work_orders')<body.indexOf('project_related_work_orders'));
});

test('linked WO IDs return Primary first, exclude null, and de-duplicate',()=>{
  const start=src.indexOf('async function getProjectLinkedWorkOrderIds');
  const end=src.indexOf('async function getProjectGanttTemplates',start);
  const body=src.slice(start,end);
  assert.match(body,/getProjectPrimaryWorkOrder\(projectId\)/);
  assert.match(body,/getProjectRelatedWorkOrders\(projectId\)/);
  assert.match(body,/primary\?\.ticket_id/);
  assert.match(body,/new Set\(/);
  assert.match(body,/filter\(Boolean\)/);
});
