'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {patchWoOptionalTechnician,LABEL_BEFORE,LABEL_AFTER,REQUIRED_GUARD}=require('../pxl-urg-0131-wo-optional-tech.js');

test('0131 restores optional technician label and removes only the mandatory check',()=>{
  const original=read('public/index.html');
  assert.ok(original.includes(REQUIRED_GUARD),'baseline should contain guard');
  assert.equal(original.split(LABEL_BEFORE).length-1,2);
  const patched=patchWoOptionalTechnician(original);
  assert.ok(!patched.includes(REQUIRED_GUARD));
  assert.equal(patched.split(LABEL_AFTER).length-1,2);
  assert.ok(!patched.includes(LABEL_BEFORE));
  assert.match(patched,/if\(canAssign&&tech1&&tech2&&tech1===tech2\)/);
  assert.match(patched,/if\(!\['Survey','Operasional','Project'\]\.includes\(selectedWorkOrderType\)\)/);
  assert.match(patched,/if\(!time\)/);
  assert.match(patched,/status:\s*'assigned'/);
  assert.match(patched,/assigned_to:\s*tech1/);
  assert.ok(patched.includes('const saved=await api('));
});

test('0131 leaves unrelated HTML, PR, Kanban and dashboard hooks intact',()=>{
  const original=read('public/index.html');
  const actual=patchWoOptionalTechnician(original);
  const expected=original.replaceAll(LABEL_BEFORE,LABEL_AFTER).replace(REQUIRED_GUARD,'');
  assert.equal(actual,expected);
  assert.equal(patchWoOptionalTechnician(actual),actual,'patch idempotent');
  const hook=read('pxl-urg-0121-pr-live-load-hook.js');
  assert.match(hook,/patchWoOptionalTechnician\(patchWoMenuDateSync\(patchWoMobileGrid\(patchWoDetail\(/);
  assert.match(hook,/pxl-urg-0121-pr-live-load\.js\?v=PXL-URG-0121/);
  assert.match(hook,/patchWoMobileGrid/);
  assert.match(hook,/patchWoMenuDateSync/);
});

test('backend optional assignment middleware already handles empty assigned_to and strips sentinel before DB insert',()=>{
  const src=read('pxl-urg-0027f-optional-tech.js');
  assert.match(src,/const wantsUnassigned = tech1 === SENTINEL \|\| \(!tech1 && !tech2\)/);
  assert.match(src,/body\.assigned_to = SENTINEL/);
  assert.match(src,/const technicians = source\.filter/);
  assert.match(src,/technician: technicians\[0\] \|\| ''/);
  assert.match(src,/const ALLOWED_ROLES = new Set\(\['admin','superadmin','manager','operator'\]\)/);
});

test('0131 leaves both technician fields optional while preserving duplicate prevention',()=>{
  const src=patchWoOptionalTechnician(read('public/index.html'));
  assert.match(src,/Teknisi 2 \(opsional\)/);
  assert.match(src,/tech1===tech2/);
  assert.doesNotMatch(src,/Wajib memilih minimal 1 teknisi/);
});
