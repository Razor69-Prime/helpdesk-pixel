'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {can,flags,configured}=require('../pxl-wh-0001g-permissions');
const reminder=require('../pxl-urg-0116a-warehouse-reminder');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const api=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public/pxl-wh-0001-ui.js'),'utf8');
test('superadmin always bypasses all Warehouse checkboxes, even explicit deny',()=>{
 const u={role:'Super Admin',custom_menus:[configured],custom_menus_override:true};
 for(const val of Object.values(flags(u)))assert.equal(val,true);
 assert.equal(reminder.canView(u),true);
});
test('legacy Warehouse roles continue to work before checklist configured',()=>{
 for(const role of ['manager','admin','warehouse','warehouseadmin']){
  const u={role,custom_menus:[],custom_menus_override:true};
  for(const val of Object.values(flags(u)))assert.equal(val,true,role);
 }
 assert.equal(reminder.canView({role:'technician',custom_menus:[]}),false);
});
test('explicit checklist permits read-only, write granularly, and explicit denial',()=>{
 const view={role:'technician',custom_menus:[configured,'warehouse_view'],custom_menus_override:true};
 assert.equal(can(view,'warehouse_view'),true);
 for(const id of ['warehouse_usage_write','warehouse_material_manage','warehouse_stock_verify'])assert.equal(can(view,id),false);
 assert.equal(can({role:'manager',custom_menus:[configured],custom_menus_override:true}),false);
 assert.equal(can({role:'admin',custom_menus:[configured,'warehouse_usage_write'],custom_menus_override:true},'warehouse_usage_write'),false);
 assert.equal(can({role:'operator',custom_menus:[configured,'warehouse_view','warehouse_usage_write']},'warehouse_usage_write'),true);
 assert.equal(can(null,'warehouse_view'),false);
 assert.equal(can({role:'sales',custom_menus:['warehouse_view']},'warehouse_usage_write'),false);
});
test('Manajemen Akun includes independent Warehouse permissions and persistent marker',()=>{
 for(const id of ['warehouse_view','warehouse_usage_write','warehouse_material_manage','warehouse_stock_verify'])
  assert.match(html,new RegExp("id:'"+id+"'"));
 assert.match(html,/id="warehouse-permission-checkboxes"/);
 assert.match(html,/checkedMenus\.push\('warehouse_access_configured'\)/);
 assert.match(html,/buildMenuCheckboxes\(currentMenus, isTargetSuperadmin\)/);
 assert.match(html,/warehouseConfigured\s*\?\s*customMenus\.includes\('warehouse_view'\)/);
});
test('backend controls Warehouse writes in addition to visibility',()=>{
 for(const id of ['warehouse_material_manage','warehouse_usage_write','warehouse_stock_verify'])assert.match(api,new RegExp(id));
 assert.match(api,/permissions:require\('\.\/pxl-wh-0001g-permissions'\)\.flags/);
 assert.match(ui,/warehousePermissions=data\.permissions\|\|\{\}/);
 assert.match(ui,/whCan\('warehouse_usage_write'\)/);
 assert.match(ui,/whCan\('warehouse_material_manage'\)/);
 assert.match(ui,/whCan\('warehouse_stock_verify'\)/);
});
test('Warehouse browser cache refreshed for permission UI',()=>{
 assert.match(html,/pxl-wh-0001-ui\.js\?v=PXL-WH-0001L/);
});
