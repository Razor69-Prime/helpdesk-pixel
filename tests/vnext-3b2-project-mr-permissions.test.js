const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const mrUi=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');

test('Account Management exposes dedicated Project MR create and approve permissions',()=>{
  assert.match(index,/Custom Fitur Project MR/);
  assert.match(index,/project_mr_create/);
  assert.match(index,/Buat \/ Input MR Project/);
  assert.match(index,/project_mr_approve/);
  assert.match(index,/Approve \/ Reject MR Project/);
});

test('Project MR create is allowed for Technician, Superadmin, or explicit project_mr_create permission',()=>{
  assert.match(server,/project_mr_create/);
  assert.match(server,/\['technician','superadmin'\]/);
  assert.match(server,/requireProjectMrCreate/);
  assert.match(mrUi,/project_mr_create/);
  assert.match(mrUi,/technician/);
  assert.match(mrUi,/superadmin/);
});

test('Project MR approve defaults to Manager Admin Superadmin and may be delegated explicitly',()=>{
  assert.match(server,/project_mr_approve/);
  assert.match(server,/\['superadmin','manager','admin'\]|\['manager','admin','superadmin'\]/);
  assert.match(server,/\['superadmin','manager','admin'\]|\['manager','admin','superadmin'\]/);
  assert.match(mrUi,/project_mr_approve/);
});

test('Project MR permissions participate in account checkbox save reset and collection flows',()=>{
  assert.match(index,/PROJECT_MR_PERMISSIONS/);
  assert.match(index,/project-mr-permission-checkboxes/);
  assert.match(index,/\.\.\.PROJECT_MR_PERMISSIONS/);
});
