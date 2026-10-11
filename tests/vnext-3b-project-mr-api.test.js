const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const db=fs.readFileSync(path.join(root,'db-core.js'),'utf8');

function route(method,url){
  const start=server.indexOf(`app.${method}('${url}'`);
  assert.notEqual(start,-1,`${method.toUpperCase()} ${url} missing`);
  const next=server.indexOf('\napp.',start+10);
  return server.slice(start,next<0?server.length:next);
}

test('db-core exposes dedicated Project MR adapters without legacy MR reuse',()=>{
  for(const fn of ['getProjectMaterialRequests','getProjectMaterialRequest','createProjectMaterialRequest','replaceProjectMaterialRequestItems','transitionProjectMaterialRequest','applyProjectMaterialRequestMovement']){
    assert.match(db,new RegExp(`async function ${fn}\\(`));
    assert.match(db,new RegExp(`\\b${fn}\\b[\\s\\S]*module\\.exports|module\\.exports[\\s\\S]*\\b${fn}\\b`));
  }
  const block=db.slice(db.indexOf('async function getProjectMaterialRequests'),db.indexOf('// PXL-STG-0010'));
  assert.doesNotMatch(block,/getMRForms|insertMRForm|getCrmMaterialRequests|issueInventoryMaterialRequest/);
});

test('Project MR routes are dedicated and include technician read/create without widening PROJECT_ROLES',()=>{
  assert.match(server,/const PROJECT_MR_READ_ROLES\s*=\s*\[[^\]]*'technician'/);
  assert.doesNotMatch(server,/const PROJECT_ROLES\s*=\s*\[[^\]]*'technician'/);
  for(const [method,url] of [
    ['get','/api/projects/:projectId/material-requests'],
    ['get','/api/project-material-requests/:id'],
    ['post','/api/projects/:projectId/material-requests'],
    ['put','/api/project-material-requests/:id/items'],
    ['post','/api/project-material-requests/:id/submit'],
    ['post','/api/project-material-requests/:id/approve'],
    ['post','/api/project-material-requests/:id/reject'],
    ['post','/api/project-material-requests/:id/movements'],
    ['post','/api/project-material-requests/:id/finalize'],
    ['get','/api/projects/:projectId/material-request-catalog']
  ]) route(method,url);
});

test('approval is Manager/Admin only and never accepts item mutation payload',()=>{
  const approve=route('post','/api/project-material-requests/:id/approve');
  const reject=route('post','/api/project-material-requests/:id/reject');
  for(const body of [approve,reject]){
    assert.match(body,/requireProjectMrApproval/);
    assert.match(body,/rejectProjectMrMutationPayload/);
  }
  assert.match(server,/function requireProjectMrApproval/);
  assert.match(server,/\['manager','admin'\]/);
});

test('requester ownership and warehouse permissions are checked server-side',()=>{
  assert.match(server,/function requireProjectMrOwner/);
  assert.match(server,/created_by_user_id/);
  const movement=route('post','/api/project-material-requests/:id/movements');
  assert.match(movement,/idempotency_key/);
  assert.match(movement,/material_request_issue/);
  assert.match(movement,/material_request_edit/);
  assert.match(movement,/take|return|use/);
});

test('catalog is project scoped and returns material BOQ plus active Inventory',()=>{
  const catalog=route('get','/api/projects/:projectId/material-request-catalog');
  assert.match(catalog,/getProjectReportItems/);
  assert.match(catalog,/getInventoryItems/);
  assert.match(catalog,/category.*material/);
  assert.match(catalog,/is_active/);
});

test('Project MR notifications use existing createNotification after successful transitions',()=>{
  for(const url of ['/api/project-material-requests/:id/submit','/api/project-material-requests/:id/approve','/api/project-material-requests/:id/reject','/api/project-material-requests/:id/movements','/api/project-material-requests/:id/finalize']){
    const body=route('post',url);
    assert.match(body,/createNotification|notifyProjectMrRoles/);
  }
  assert.match(server,/function notifyProjectMrRoles/);
  assert.match(server,/target_role:\s*'manager'|\['manager','admin','superadmin'\]/);
  assert.match(server,/\['manager','admin','superadmin'\]/);
});

test('legacy MR routes and inventory issue surface remain present',()=>{
  assert.match(server,/\/api\/material-requests-form/);
  assert.match(server,/\/api\/crm\/material-requests/);
  assert.match(db,/async function issueInventoryMaterialRequest/);
});

test('BOQ catalog resolves exact active Inventory match and submit blocks unmapped material',()=>{
  const catalog=route('get','/api/projects/:projectId/material-request-catalog');
  assert.match(catalog,/inventory_item_id/);
  assert.match(catalog,/toLowerCase\(\).*trim\(\)|trim\(\).*toLowerCase\(\)/s);
  const submit=route('post','/api/project-material-requests/:id/submit');
  assert.match(submit,/inventory_item_id/);
  assert.match(submit,/terhubung ke Inventory|Inventory.*wajib/i);
});

test('Project MR read roles exclude Sales unless explicit legacy MR permission grants access',()=>{
  const match=server.match(/const PROJECT_MR_READ_ROLES\s*=\s*\[([^\]]+)\]/);
  assert.ok(match,'PROJECT_MR_READ_ROLES missing');
  assert.doesNotMatch(match[1],/'sales'/);
  assert.match(match[1],/'technician'/);assert.match(match[1],/'manager'/);assert.match(match[1],/'admin'/);assert.match(match[1],/'superadmin'/);
});
