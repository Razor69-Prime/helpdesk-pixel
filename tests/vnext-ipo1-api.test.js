const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');

function route(method,pathText){
  const marker=`app.${method}(\'${pathText}\'`;
  const start=src.indexOf(marker);
  assert.ok(start>=0,`${method.toUpperCase()} ${pathText} must exist`);
  const end=src.indexOf('\n});',start);
  assert.ok(end>start,`${method.toUpperCase()} ${pathText} must have route terminator`);
  return src.slice(start,end+4);
}


test('Project read gate honors explicit projects menu without letting Internal PO permission grant Project access',()=>{
  assert.match(src,/function hasProjectTrackerRead\(req\)/);
  const helper=src.match(/function hasProjectTrackerRead\(req\)\{[\s\S]*?\n\}/);
  assert.ok(helper,'hasProjectTrackerRead must exist');
  assert.match(helper[0],/custom\.includes\('projects'\)/);
  assert.doesNotMatch(helper[0],/project_internal_po_manage/);
  assert.match(src,/app\.get\('\/api\/projects', requireProjectTrackerRead/);
  assert.match(src,/app\.get\('\/api\/projects\/:id\/detail', requireProjectTrackerRead/);
  assert.match(src,/app\.get\('\/api\/project-report-summaries', requireProjectTrackerRead/);
  assert.match(src,/app\.post\('\/api\/projects', requireRole\(\.\.\.PROJECT_ROLES\)/);
  assert.match(src,/app\.patch\('\/api\/projects\/:id', requireRole\(\.\.\.PROJECT_ROLES\)/);
});

test('server imports Internal PO normalization and defines manage permission defaults',()=>{
  assert.match(src,/require\(['"]\.\/project-internal-po['"]\)/);
  assert.match(src,/function hasProjectInternalPoManage\(req\)/);
  assert.match(src,/project_internal_po_manage/);
  assert.match(src,/\['manager','admin','accounting'\]\.includes\(role\)/);
  assert.match(src,/custom_menus_override===true/);
  assert.match(src,/function requireProjectInternalPoManage\(req,res,next\)/);
});

test('Internal PO read routes keep Project read role gate and expose read-only can_manage',()=>{
  for(const p of ['/api/projects/:projectId/internal-po','/api/projects/:projectId/internal-po/history']){
    const r=route('get',p);
    assert.match(r,/requireProjectTrackerRead/);
  }
  const read=route('get','/api/projects/:projectId/internal-po');
  assert.match(read,/can_manage\s*:\s*hasProjectInternalPoManage\(req\)/);
});

test('support and save routes require both Project read role and Internal PO manage permission',()=>{
  for(const [method,p] of [['get','/api/projects/:projectId/internal-po/purchase-requests'],['get','/api/projects/:projectId/internal-po/boq-options'],['put','/api/projects/:projectId/internal-po']]){
    const r=route(method,p);
    assert.match(r,/requireProjectTrackerRead/);
    assert.match(r,/requireProjectInternalPoManage/);
  }
});

test('PUT normalizes server-side validates exact Project Material BOQ and uses one atomic adapter',()=>{
  const r=route('put','/api/projects/:projectId/internal-po');
  assert.match(r,/normalizeInternalPoDraft\(/);
  assert.match(r,/db\.getProjectReportItems\(projectId\)/);
  assert.match(r,/String\(row\.category\|\|''\)\.toLowerCase\(\)==='material'/);
  assert.match(r,/source_boq_item_id/);
  assert.match(r,/db\.saveProjectInternalPo\(/);
  assert.doesNotMatch(r,/insertProjectInternalPo|updateProjectInternalPo|deleteProjectInternalPo/);
  assert.match(r,/logActivity\(/);
});


test('PUT validates live BOQ only for new rows so saved snapshots survive later BOQ deletion',()=>{
  const r=route('put','/api/projects/:projectId/internal-po');
  assert.match(r,/row\.source_type==='boq'&&\!row\.id/);
});

test('Internal PO routes never mutate PR Inventory MR BOQ Project Report or finance adapters',()=>{
  const start=src.indexOf("app.get('/api/projects/:projectId/internal-po'");
  const end=src.indexOf('// PXL-VNEXT-3A',start);
  assert.ok(start>=0&&end>start,'Internal PO route block must be bounded before 3A routes');
  const block=src.slice(start,end);
  for(const forbidden of ['insertPurchaseRequest','updatePurchaseRequest','deletePurchaseRequest','updateInventory','insertInventory','insertProjectMaterialRequest','replaceProjectMaterialRequestItems','updateProjectReportItem','insertProjectReportItem','insertCrmInvoice','insertStandaloneInvoice','insertSupplier','updateSupplier']){
    assert.doesNotMatch(block,new RegExp(`db\\.${forbidden}\\b`));
  }
});

test('failure paths are explicit for project missing bad draft BOQ tampering and save errors',()=>{
  const r=route('put','/api/projects/:projectId/internal-po');
  assert.match(r,/404/);
  assert.match(r,/400/);
  assert.match(r,/Item BOQ.*Material.*Project/i);
  assert.match(r,/res\.status\(500\)/);
  const support=route('get','/api/projects/:projectId/internal-po/boq-options');
  assert.match(support,/404/);
});
