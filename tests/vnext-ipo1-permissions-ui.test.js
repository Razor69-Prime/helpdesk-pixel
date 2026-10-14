const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');

test('Project permission checklist includes Internal PO manage under Project permissions',()=>{
  const block=src.match(/const PROJECT_PERMISSIONS=\[[\s\S]*?\];/);
  assert.ok(block,'PROJECT_PERMISSIONS must exist');
  assert.match(block[0],/project_internal_po_manage/);
  assert.match(block[0],/🧾 Kelola Internal PO Project/);
  assert.match(src,/project-permission-checkboxes/);
});

test('Internal PO permission participates in checkbox collection and all permission flows',()=>{
  assert.match(src,/\.\.\.PROJECT_PERMISSIONS/);
  assert.match(src,/allPermissionIds=\[\.\.\.ALL_MENUS,[^\n]+\.\.\.PROJECT_PERMISSIONS/);
  assert.match(src,/function getCheckedMenus\(\)[\s\S]*\.\.\.PROJECT_PERMISSIONS/);
  assert.match(src,/function setAllMenus\(val\)[\s\S]*\.\.\.PROJECT_PERMISSIONS/);
  assert.match(src,/function resetMenuToRole\(\)[\s\S]*projectDefaults/);
});

test('role reset defaults Internal PO manage for Superadmin Manager Admin Accounting only',()=>{
  const fn=src.match(/function resetMenuToRole\(\)[\s\S]*?\n}\n/);
  assert.ok(fn,'resetMenuToRole must exist');
  assert.match(fn[0],/project_internal_po_manage/);
  assert.match(fn[0],/role==='manager'\?\['project_boq_manage','project_internal_po_manage'\]/);
  assert.match(fn[0],/\['admin','accounting'\]\.includes\(role\)\?\['project_internal_po_manage'\]/);
  assert.doesNotMatch(fn[0],/role==='(?:sales|technician|operator)'[^\n]+project_internal_po_manage/);
});

test('no new sidebar menu is created for Internal PO',()=>{
  const menus=src.match(/const ALL_MENUS=\[[\s\S]*?\];/);
  assert.ok(menus,'ALL_MENUS must exist');
  assert.doesNotMatch(menus[0],/internal[_ -]?po/i);
});
