const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
const patchPath=path.join(root,'pxl-urg-0117-superadmin-boq-done-bypass.js');

test('0117 isolated module is loaded before routes and targets only detail BOQ PATCH',()=>{
  assert.match(config,/require\('\.\/pxl-urg-0117-superadmin-boq-done-bypass'\)/);
  assert.ok(fs.existsSync(patchPath),'0117 isolated patch module must exist');
  const src=fs.readFileSync(patchPath,'utf8');
  assert.match(src,/\/api\/project-report-items\/:id/);
  assert.match(src,/normalizedRole\(req\) === 'superadmin'/);
  assert.match(src,/AsyncLocalStorage/);
  assert.match(src,/consumeDoneBypass/);
  assert.doesNotMatch(src,/PXL-URG-0116|warehouse_status|material_return_verify/);
});

test('bypass predicate is Superadmin-only and route-scoped',()=>{
  const mod=require('../pxl-urg-0117-superadmin-boq-done-bypass');
  const req=role=>({session:{user:{role}},body:{boq_qty:10}});
  assert.equal(mod.shouldBypass(req('superadmin'),'/api/project-report-items/:id'),true);
  assert.equal(mod.shouldBypass(req('manager'),'/api/project-report-items/:id'),false);
  assert.equal(mod.shouldBypass(req('admin'),'/api/project-report-items/:id'),false);
  assert.equal(mod.shouldBypass(req('superadmin'),'/api/project-reports/:projectId/boq'),false);
});
