const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/pxl-vnext-3b-project-mr.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

function functionBlock(name){
  const start=server.indexOf(`function ${name}`);assert.notEqual(start,-1,`${name} missing`);
  const next=server.indexOf('\nfunction ',start+20);return server.slice(start,next<0?server.length:next);
}

test('Superadmin may approve or reject Project MR without delegated permission',()=>{
  const block=functionBlock('requireProjectMrApproval');
  assert.doesNotMatch(block,/projectMrRole\(req\)===['"]superadmin['"][^\n]*403|Superadmin monitoring/i);
  assert.match(block,/\['superadmin','manager','admin'\]|\['manager','admin','superadmin'\]/);
});

test('Project MR UI exposes approval actions to Superadmin on submitted MR',()=>{
  const start=ui.indexOf('function canApprove');assert.notEqual(start,-1);
  const block=ui.slice(start,ui.indexOf('\n  function ',start+20));
  assert.doesNotMatch(block,/role\(\)!==['"]superadmin['"]/);
  assert.match(block,/superadmin/);
});

test('Account Management documents Superadmin as default Project MR approver',()=>{
  assert.match(index,/Super Admin[^<]*(Approve|approval)|Approve\/Reject default[^<]*Super Admin/i);
  assert.match(index,/role==='superadmin'[^\n]*project_mr_create[^\n]*project_mr_approve|projectMrDefaults[^\n]*superadmin/s);
});

test('other major approval flows retain Superadmin approval access',()=>{
  assert.match(server,/if\(String\(u\.role\|\|''\)\.toLowerCase\(\)==='superadmin'\) return true;/);
  assert.match(server,/const PR_ROLES = \['superadmin','manager','accounting','admin'\]/);
  assert.match(server,/additional-materials\/:id\/internal-approve',/);
  assert.match(server,/internal-approve',requireRole\('manager','admin','superadmin'\)/);
  assert.match(index,/const isApproval1=_isSuperAdmin\|\|/);
  assert.match(index,/const isApproval2=_isSuperAdmin\|\|/);
});

test('Superadmin bypasses Leave approval checkbox and Invoice reviewer includes Superadmin',()=>{
  const leave=fs.readFileSync(path.join(root,'pxl-stg-0009a-leave-api.js'),'utf8');
  const invoice=fs.readFileSync(path.join(root,'pxl-stg-0008a-invoice-api.js'),'utf8');
  assert.match(leave,/role[^\n]*superadmin|superadmin[^\n]*return true/i);
  assert.match(invoice,/if \(role === ['"]superadmin['"] \|\| allowed\.includes\(role\)\) return next\(\);/);
  assert.match(invoice,/const reviewer = roles\(['"]manager['"],['"]admin['"]\)/);
});
