'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const api=read('server.js'),db=read('db-core.js'),ui=read('public/pxl-urg-0116b-warehouse-ui.js'),html=read('public/index.html'),sql=read('PXL-URG-0116B-MIGRATION.sql');
const reminder=require('../pxl-urg-0116a-warehouse-reminder');
test('warehouse UI uses one separate internal menu and is hidden from technicians',()=>{
 assert.match(html,/id="tab-warehouse_mr"/);assert.match(html,/id:'warehouse_mr',label:'📋 Verifikasi MR Gudang'/);
 assert.match(html,/role!=='technician'&&role!=='technisi'/);
 assert.match(html,/if\(tab==='warehouse_mr'&&window.pxlWarehouseMr\)/);
 assert.match(ui,/if\(\['technician','technisi'\].includes\(role\)\)return false/);
 assert.ok(!html.includes('warehouse_mr</script>'));
});
test('queue returns unresolved MR with item details without changing MR',()=>{
 const result=reminder.pendingForTickets({tickets:[{id:'a',status:'working'},{id:'b',status:'done'}],mrs:[{id:1,ticket_id:'a',status:'draft',items:[{qty:3}]},{id:2,ticket_id:'b',status:'returned',items:[{qty:2}]}]},{all:true});
 assert.equal(result.length,1);assert.equal(result[0].mr_id,1);assert.equal(result[0].items[0].qty,3);
});
test('server protects both read and write endpoints from technicians',()=>{
 const get=api.slice(api.indexOf("app.get('/api/warehouse/mr-review'"),api.indexOf("app.post('/api/warehouse/mr-review/"));
 const post=api.slice(api.indexOf("app.post('/api/warehouse/mr-review/"),api.indexOf('// PXL-URG-0116A — internal-only'));
 assert.match(get,/if\(!mod.canView\(req.session\?\.user\)\)return res.status\(403\)/);
 assert.match(post,/if\(!mod.canView\(req.session\?\.user\)\)return res.status\(403\)/);
 assert.match(post,/if\(!\['mr_form','crm_mr'\].includes\(source\)\)/);
 assert.match(post,/if\(!\['checked','discrepancy'\].includes\(outcome\)\)/);
 assert.match(post,/Number.isFinite\(qty\)/);
});
test('inspection audit is append-only, and no stock or MR mutation is made',()=>{
 assert.match(db,/async function insertWarehouseMrAudit/);
 assert.match(db,/restFetch\('POST','\/warehouse_mr_inspection_audit',data\)/);
 assert.doesNotMatch(db.slice(db.indexOf('async function insertWarehouseMrAudit'),db.indexOf('module.exports = {')),/updateInventory|updateMRForm|updateCrmMaterialRequest/);
 assert.match(api,/stock_changed:false,mr_status_changed:false/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public.warehouse_mr_inspection_audit/);
 assert.match(sql,/REVOKE ALL ON public.warehouse_mr_inspection_audit FROM PUBLIC/);
 assert.doesNotMatch(sql,/UPDATE\s+inventory|UPDATE\s+material_request/i);
});
test('UI escapes MR and audit data, includes quantity and history',()=>{
 assert.match(ui,/const esc=/);assert.match(ui,/function itemsHtml/);assert.match(ui,/function historyHtml/);
 assert.match(ui,/function detail/);assert.match(ui,/async function submit/);
 assert.match(ui,/quantity_checked:qty,note/);
 assert.match(ui,/Tidak ada mutasi stok/);
});
