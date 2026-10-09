const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const policyPath=path.join(root,'pxl-urg-0108-mr-stock-policy.js');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

function loadPolicy(){
  assert.equal(fs.existsSync(policyPath),true,'MR stock policy module must exist');
  return require(policyPath);
}

test('field addition with insufficient stock becomes warehouse-pending draft',()=>{
  const {assessMaterialRequestStock}=loadPolicy();
  const result=assessMaterialRequestStock([
    {inventory_item_id:'add-1',name:'Tambahan Lapangan',qty_out:2,field_addition:true}
  ],[
    {id:'add-1',name:'Tambahan Lapangan',stock:0,unit:'pcs',is_active:true}
  ]);
  assert.equal(result.ok,true);
  assert.equal(result.pendingWarehouse,true);
  assert.equal(result.canIssue,false);
  assert.deepEqual(result.pendingItemIds,['add-1']);
});

test('normal SO item with insufficient stock remains a blocking shortage',()=>{
  const {assessMaterialRequestStock}=loadPolicy();
  const result=assessMaterialRequestStock([
    {inventory_item_id:'so-1',name:'Item SO',qty_out:3,field_addition:false}
  ],[
    {id:'so-1',name:'Item SO',stock:1,unit:'pcs',is_active:true}
  ]);
  assert.equal(result.ok,false);
  assert.equal(result.pendingWarehouse,false);
  assert.match(result.error,/Stok Item SO tidak cukup/);
});

test('sufficient inventory can still be issued immediately',()=>{
  const {assessMaterialRequestStock}=loadPolicy();
  const result=assessMaterialRequestStock([
    {inventory_item_id:'add-2',name:'Tambahan Cukup',qty_out:2,field_addition:true},
    {inventory_item_id:'so-2',name:'Item SO Cukup',qty_out:1,field_addition:false}
  ],[
    {id:'add-2',name:'Tambahan Cukup',stock:5,unit:'pcs',is_active:true},
    {id:'so-2',name:'Item SO Cukup',stock:4,unit:'pcs',is_active:true}
  ]);
  assert.equal(result.ok,true);
  assert.equal(result.pendingWarehouse,false);
  assert.equal(result.canIssue,true);
});

test('MR POST checks stock before insert and removes temporary draft if issuing unexpectedly fails',()=>{
  const start=server.indexOf("app.post('/api/material-requests-form'");
  const end=server.indexOf("app.patch('/api/material-requests-form/:id'",start);
  assert.ok(start>=0&&end>start,'MR POST route must be present');
  const route=server.slice(start,end);
  const assessAt=route.indexOf('assessMaterialRequestStock');
  const insertAt=route.indexOf('db.insertMRForm');
  assert.ok(assessAt>=0&&insertAt>=0&&assessAt<insertAt,'stock assessment must happen before MR insert');
  assert.match(route,/await db\.deleteMRForm\(entry\.id\)/,'failed issue must clean the temporary draft');
});

test('MR UI explains when a taken request is downgraded to Draft Menunggu Gudang',()=>{
  assert.match(index,/Draft \/ Menunggu Gudang/);
  assert.match(index,/Stok belum dikurangi/);
});
