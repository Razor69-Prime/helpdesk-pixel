const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');

function route(method,pathText){
  const marker=`app.${method}('${pathText}'`;
  const start=server.indexOf(marker);
  assert.ok(start>=0,`${method.toUpperCase()} ${pathText} must exist`);
  const next=server.indexOf('\napp.',start+marker.length);
  return server.slice(start,next<0?server.length:next);
}

test('Phase 3A Project Detail and search GET routes reuse Project Tracker read protection',()=>{
  const detail=route('get','/api/projects/:id/detail');
  const options=route('get','/api/projects/:id/work-order-options');
  const gantt=route('get','/api/projects/:id/gantt-plan');
  for(const body of [detail,options,gantt]) assert.match(body,/requireRole\(\.\.\.PROJECT_ROLES\)/);
  assert.match(detail,/buildProjectReportRows\(\)/);
  assert.match(detail,/getProjectPrimaryWorkOrder/);
  assert.match(detail,/getProjectGanttPlan/);
  assert.match(detail,/unavailable:true/);
});

test('Phase 3A management permissions are explicit and only Superadmin bypasses custom permission',()=>{
  assert.match(server,/function hasProjectVnextPermission\(req,\s*permission\)/);
  assert.match(server,/role\s*===\s*['"]superadmin['"]\)\s*return true/);
  assert.match(server,/custom\.includes\(permission\)/);
  assert.match(server,/requireProjectVnextPermission\(['"]project_primary_wo_manage['"]\)/);
  assert.match(server,/requireProjectVnextPermission\(['"]project_gantt_manage['"]\)/);
});

test('Primary WO APIs validate project and WO, enforce one-WO ownership, and never mutate WO',()=>{
  const put=route('put','/api/projects/:id/primary-work-order');
  const del=route('delete','/api/projects/:id/primary-work-order');
  assert.match(put,/getProjects\(\)/);
  assert.match(put,/getTicketById\(ticketId\)/);
  assert.match(put,/status\(404\)/);
  assert.match(put,/status\(409\)/);
  assert.match(put,/getProjectWorkOrderOwner/);
  assert.match(put,/upsertProjectPrimaryWorkOrder/);
  assert.doesNotMatch(put,/updateTicket\(/,'linking must not update the WO');
  assert.match(del,/upsertProjectPrimaryWorkOrder\([^,]+,\s*null/);
  assert.doesNotMatch(del,/deleteTicket\(|updateTicket\(/,'unlinking must not delete or update WO');
  assert.match(put,/LINK PRIMARY WO/);
  assert.match(del,/UNLINK PRIMARY WO/);
});

test('Gantt PUT calculates server-side before atomic persistence and logs create/update',()=>{
  const put=route('put','/api/projects/:id/gantt-plan');
  const calcAt=put.indexOf('buildSequentialGanttPlan');
  const saveAt=put.indexOf('replaceProjectGanttPlan');
  assert.ok(calcAt>=0&&saveAt>calcAt,'server date calculation must happen before persistence');
  assert.match(put,/status\(404\)/);
  assert.match(put,/CREATE GANTT PLAN/);
  assert.match(put,/UPDATE GANTT PLAN/);
});

test('existing SO to WO and WO to MR routes remain present',()=>{
  assert.match(server,/app\.post\(['"]\/api\/sales-orders\/:id\/work-order['"]/);
  assert.match(server,/app\.post\(['"]\/api\/sales-orders\/:id\/material-request['"]/);
});
