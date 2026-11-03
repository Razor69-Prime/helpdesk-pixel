const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const {canMoveScheduleDate}=require(path.join(root,'pxl-urg-0130-manager-date-policy.js'));

test('0130 manager and superadmin can reschedule non-cancelled WO regardless of operational status',()=>{
  for(const role of ['manager','superadmin']){
    for(const status of ['assigned','ongoing','travelling','done','selesai','completed']){
      assert.equal(canMoveScheduleDate({role,status}),true,`${role} should reschedule ${status}`);
    }
  }
});

test('0130 non-manager roles keep legacy Assigned/Waiting restriction',()=>{
  assert.equal(canMoveScheduleDate({role:'admin',status:'assigned'}),true);
  assert.equal(canMoveScheduleDate({role:'operator',status:'waiting'}),true);
  assert.equal(canMoveScheduleDate({role:'technician',status:'ongoing'}),false);
  assert.equal(canMoveScheduleDate({role:'admin',status:'done'}),false);
});

test('0130 cancelled WO remains date-locked even for manager/superadmin',()=>{
  assert.equal(canMoveScheduleDate({role:'manager',status:'cancelled'}),false);
  assert.equal(canMoveScheduleDate({role:'superadmin',status:'cancelled'}),false);
});
