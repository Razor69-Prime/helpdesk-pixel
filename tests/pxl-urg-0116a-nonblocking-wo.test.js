const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const flow=fs.readFileSync(path.join(root,'pxl-stg-0008a30-flow-guard.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const r=require('../pxl-urg-0116a-warehouse-reminder');
test('WO finishing retains signature guard without MR blocking',()=>{
 assert.equal((flow.match(/return requireCompletionSignatures\(req, res, next\);/g)||[]).length,2);
 assert.doesNotMatch(flow,/requireCompletionSignatures\(req, res, \(\) => requireMaterialTaken/);
});
test('technician cannot view internal reminder',()=>{
 for(const role of ['technician','technisi','sales','operator'])assert.equal(r.canView({role}),false);
 for(const role of ['manager','admin','superadmin','warehouse_admin'])assert.equal(r.canView({role}),true);
 assert.equal(r.canView({role:'technician',custom_menus:['material_return_verify']}),false);
 assert.match(server,/if\(!reminder.canView\(req.session\?\.user\)\)return res.status\(403\)/);
});
test('only closed WO with unresolved MR are internal pending',()=>{
 const x=r.pendingForTickets({tickets:[{id:1,status:'completed',wo_number:'WO-1'},{id:2,status:'working'}],mrs:[{id:11,ticket_id:1,status:'draft'},{id:12,ticket_id:1,status:'returned'},{id:13,ticket_id:2,status:'draft'}]});
 assert.deepEqual(x.map(a=>a.mr_id),[11]); assert.equal(x[0].wo_number,'WO-1');
});
test('CRM MR linkage and warehouse verification',()=>{
 const x=r.pendingForTickets({tickets:[{id:'t',status:'done'}],crmWorkOrders:[{id:'w',ticket_id:'t'}],crmRequests:[{id:'m1',work_order_id:'w',status:'taken',warehouse_status:'pending_verification'},{id:'m2',work_order_id:'w',warehouse_status:'verified'}]});
 assert.deepEqual(x.map(a=>a.mr_id),['m1']);
});
