const test=require('node:test');
const assert=require('node:assert/strict');
const {
  witaParts, workDateWita, defaultAttendanceRules, resolveAttendanceRule,
  calculateCheckInStatus, calculateCheckOutStatus
}=require('../pxl-attendance-core');

function z(iso){return new Date(iso)}

test('default rules are Mon-Fri 08:00-16:30, Sat 08:30-13:00, Sun off in WITA',()=>{
  const rules=defaultAttendanceRules();
  assert.equal(rules.length,7);
  for(let d=1;d<=5;d++) assert.deepEqual(rules.find(r=>r.day_of_week===d),{day_of_week:d,is_workday:true,check_in_time:'08:00',check_out_time:'16:30',timezone:'Asia/Makassar',overtime_stage1_minutes:120,overtime_stage2_minutes:240,is_active:true});
  assert.equal(rules.find(r=>r.day_of_week===6).check_in_time,'08:30');
  assert.equal(rules.find(r=>r.day_of_week===6).check_out_time,'13:00');
  assert.equal(rules.find(r=>r.day_of_week===7).is_workday,false);
});

test('WITA work date and weekday do not depend on VPS timezone',()=>{
  assert.equal(workDateWita(z('2026-10-16T16:30:00Z')),'2026-10-17');
  const p=witaParts(z('2026-10-16T16:30:00Z'));
  assert.equal(p.hour,0); assert.equal(p.minute,30); assert.equal(p.dayOfWeek,6);
});

test('check-in exact start is on time and one minute later is late',()=>{
  const r=resolveAttendanceRule(defaultAttendanceRules(),z('2026-10-19T00:00:00Z'));
  assert.equal(calculateCheckInStatus(r,z('2026-10-19T00:00:00Z')).status,'on_time'); // 08:00 WITA
  assert.equal(calculateCheckInStatus(r,z('2026-10-19T00:01:00Z')).status,'late');
});

test('Saturday exact 08:30 WITA is on time',()=>{
  const r=resolveAttendanceRule(defaultAttendanceRules(),z('2026-10-17T00:30:00Z'));
  assert.equal(r.day_of_week,6);
  assert.equal(calculateCheckInStatus(r,z('2026-10-17T00:30:00Z')).status,'on_time');
});

test('Sunday attendance is off day',()=>{
  const r=resolveAttendanceRule(defaultAttendanceRules(),z('2026-10-18T03:00:00Z'));
  assert.equal(calculateCheckInStatus(r,z('2026-10-18T03:00:00Z')).status,'off_day');
  assert.equal(calculateCheckOutStatus(r,z('2026-10-18T03:00:00Z')).status,'off_day');
});

test('checkout boundaries are deterministic',()=>{
  const r=resolveAttendanceRule(defaultAttendanceRules(),z('2026-10-19T08:30:00Z'));
  assert.equal(calculateCheckOutStatus(r,z('2026-10-19T08:29:00Z')).status,'early_checkout'); // 16:29
  let x=calculateCheckOutStatus(r,z('2026-10-19T08:30:00Z')); // 16:30
  assert.equal(x.status,'normal'); assert.equal(x.overtime_stage,0);
  x=calculateCheckOutStatus(r,z('2026-10-19T10:29:00Z')); // +119
  assert.equal(x.overtime_stage,0);
  x=calculateCheckOutStatus(r,z('2026-10-19T10:30:00Z')); // +120
  assert.equal(x.overtime_stage,1); assert.equal(x.overtime_eligible_minutes,120);
  x=calculateCheckOutStatus(r,z('2026-10-19T12:29:00Z')); // +239
  assert.equal(x.overtime_stage,1);
  x=calculateCheckOutStatus(r,z('2026-10-19T12:30:00Z')); // +240
  assert.equal(x.overtime_stage,2); assert.equal(x.overtime_eligible_minutes,240);
});
