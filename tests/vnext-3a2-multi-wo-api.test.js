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

test('Project Detail returns authoritative Primary plus Related WO arrays',()=>{
  const detail=route('get','/api/projects/:id/detail');
  assert.match(detail,/getProjectPrimaryWorkOrder/);
  assert.match(detail,/getProjectRelatedWorkOrders/);
  assert.match(detail,/related_work_orders:relatedWorkOrders/);
  assert.match(detail,/Promise\.all\(relatedRelations\.map/);
  assert.match(detail,/unavailable:true/);
});

test('Primary WO link uses normalized owner helper and rejects Related or other-project ownership',()=>{
  const put=route('put','/api/projects/:id/primary-work-order');
  assert.match(put,/getProjectWorkOrderOwner\(ticketId\)/);
  assert.match(put,/owner\.kind===['"]primary['"]/);
  assert.match(put,/String\(owner\.project_id\)===String\(req\.params\.id\)/);
  assert.match(put,/status\(409\)/);
  assert.match(put,/upsertProjectPrimaryWorkOrder/);
});

test('Related WO link route requires permission, existing project and existing WO, and rejects any owner',()=>{
  const post=route('post','/api/projects/:id/related-work-orders');
  assert.match(post,/requireProjectVnextPermission\(['"]project_primary_wo_manage['"]\)/);
  assert.match(post,/getProjects\(\)/);
  assert.match(post,/getTicketById\(ticketId\)/);
  assert.match(post,/status\(404\)/);
  assert.match(post,/getProjectWorkOrderOwner\(ticketId\)/);
  assert.match(post,/if\(owner\) return res\.status\(409\)/);
  assert.match(post,/linkProjectRelatedWorkOrder/);
  assert.match(post,/LINK RELATED WO/);
  assert.doesNotMatch(post,/insertTicket\(|updateTicket\(|deleteTicket\(/);
});

test('Related WO unlink only removes this project relation and preserves WO',()=>{
  const del=route('delete','/api/projects/:id/related-work-orders/:ticketId');
  assert.match(del,/requireProjectVnextPermission\(['"]project_primary_wo_manage['"]\)/);
  assert.match(del,/getProjectRelatedWorkOrders\(req\.params\.id\)/);
  assert.match(del,/unlinkProjectRelatedWorkOrder/);
  assert.match(del,/UNLINK RELATED WO/);
  assert.doesNotMatch(del,/deleteTicket\(|updateTicket\(/);
});

test('database ownership conflicts from either relation map to HTTP 409',()=>{
  const post=route('post','/api/projects/:id/related-work-orders');
  const put=route('put','/api/projects/:id/primary-work-order');
  for(const body of [post,put]){
    assert.match(body,/23505|unique|duplicate|terhubung/i);
    assert.match(body,/status\(409\)/);
  }
});

test('existing SO→WO and WO→MR surfaces remain present',()=>{
  assert.match(server,/app\.post\(['"]\/api\/sales-orders\/:id\/work-order['"]/);
  assert.match(server,/app\.post\(['"]\/api\/sales-orders\/:id\/material-request['"]/);
});
