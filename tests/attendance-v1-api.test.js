const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const mod=require('../pxl-attendance-api');

test('GPS validator requires finite valid latitude longitude accuracy',()=>{
  const {validGps}=mod._test;
  assert.equal(validGps({latitude:-8.65,longitude:115.2,accuracy:12}),true);
  for(const x of [{latitude:null,longitude:115,accuracy:2},{latitude:91,longitude:115,accuracy:2},{latitude:-8,longitude:181,accuracy:2},{latitude:-8,longitude:115,accuracy:-1},{latitude:'x',longitude:115,accuracy:2}])assert.equal(validGps(x),false);
});

test('attendance administration is HR-only with superadmin bypass',async()=>{
  const {hasAttendancePermission}=mod._test;
  const db={getUsers:async()=>[{id:'1',role:'hr',custom_menus:[]},{id:'2',role:'manager',custom_menus:['attendance_view_all']},{id:'3',role:'admin',custom_menus:['attendance_manage']}]};
  assert.equal(await hasAttendancePermission({session:{user:{id:'1',role:'hr'}}},'attendance_view_all',db),true);
  assert.equal(await hasAttendancePermission({session:{user:{id:'2',role:'manager'}}},'attendance_view_all',db),false);
  assert.equal(await hasAttendancePermission({session:{user:{id:'3',role:'admin'}}},'attendance_manage',db),false);
  assert.equal(await hasAttendancePermission({session:{user:{id:'9',role:'superadmin'}}},'attendance_manage',db),true);
});

test('capture tokens bind user event and deterministic Cloudinary public id',()=>{
  const {tokenHash,attendancePublicId}=mod._test;
  const h=tokenHash('secret');assert.equal(h.length,64);
  const id=attendancePublicId('u 1','2026-10-17','CHECK_IN',h);
  assert.match(id,/^attendance\/u-1\/2026-10-17\/check-in\/[a-f0-9]{16}$/);
});

test('server installs protected attendance API and does not trust client status/timestamp',()=>{
  const api=fs.readFileSync('pxl-attendance-api.js','utf8'),server=fs.readFileSync('server.js','utf8');
  for(const r of ['/api/attendance/today','/api/attendance/me','/api/attendance/capture-context','/api/attendance/photo-signature','/api/attendance/check-in','/api/attendance/check-out','/api/attendance/admin','/api/attendance/rules'])assert.ok(api.includes(r),r);
  assert.match(api,/requireAuth/);assert.match(api,/consumeAttendanceCaptureToken/);assert.doesNotMatch(api,/CHECK_OUT tanpa CHECK_IN|CHECK_IN wajib terlebih dahulu/i);assert.match(api,/event===['"]CHECK_OUT['"]/);assert.match(api,/insertAttendanceRecord\(patch\)/);
  assert.doesNotMatch(api,/check_in_at\s*:\s*req\.body\.check_in_at/);assert.doesNotMatch(api,/check_out_at\s*:\s*req\.body\.check_out_at/);assert.doesNotMatch(api,/status\s*:\s*req\.body\.status/);
  assert.match(server,/pxl-attendance-api/);
});

test('admin permission constants and superadmin bypass are explicit',()=>{const s=fs.readFileSync('pxl-attendance-api.js','utf8');for(const p of ['attendance_view_all','attendance_manage_rules','attendance_manage'])assert.match(s,new RegExp(p));assert.match(s,/superadmin/);assert.match(s,/role.*hr|hr.*role/i);});
