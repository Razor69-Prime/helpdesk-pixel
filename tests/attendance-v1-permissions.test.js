const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');

test('Account Management exposes HR role for create and edit',()=>{const s=read('public/index.html');assert.ok((s.match(/<option value="hr">HR<\/option>/g)||[]).length>=2);});

test('HR leave admin remains checklist while attendance administration is role-based',()=>{const s=read('public/index.html');assert.match(s,/hr_admin_manage/);assert.match(s,/HR_ATTENDANCE_PERMISSIONS/);assert.match(s,/hr-attendance-permission-checkboxes/);const block=s.match(/const HR_ATTENDANCE_PERMISSIONS=\[[\s\S]*?\];/)[0];for(const p of ['attendance_view_all','attendance_manage_rules','attendance_manage'])assert.doesNotMatch(block,new RegExp(p));});

test('role defaults do not implicitly grant HR leave admin checklist',()=>{const s=read('public/index.html');const block=s.match(/function resetMenuToRole\(\)[\s\S]*?\n}\n/)[0];assert.doesNotMatch(block,/['\"]hr_admin_manage['\"]/);});

test('single source collectors persist custom HR and attendance checkboxes through data-menu',()=>{const a=read('public/pxl-urg-0016a-account-permission-single-source.js'),b=read('public/pxl-urg-0017-account-permission-hard-save.js');assert.match(a,/\[data-menu\]:checked/);assert.match(b,/\[data-menu\]:checked/);assert.match(b,/applyStoredPermissions/);});

test('Leave Admin HR gate is hr_admin_manage checklist or superadmin only',()=>{const api=read('pxl-stg-0009a-leave-api.js'),ui=read('public/pxl-stg-0009a-leave.js');assert.match(api,/hr_admin_manage/);assert.match(api,/superadmin/);assert.doesNotMatch(api,/const hrRoles=new Set\(\['manager','admin','superadmin'\]\)/);assert.match(ui,/hr_admin_manage/);assert.match(ui,/superadmin/);assert.doesNotMatch(ui,/\['manager','admin','superadmin'\]\.includes\(role\(\)\)/);});

test('leave approval remains independent and superadmin bypass remains',()=>{const api=read('pxl-stg-0009a-leave-api.js');assert.match(api,/pr_roles.*leave_approve/);assert.match(api,/norm\(user\(req\)\?\.role\)===['"]superadmin['"]/);assert.doesNotMatch(api,/hr_admin_manage[^\n]{0,100}leave_approve|leave_approve[^\n]{0,100}hr_admin_manage/);});


test('attendance admin checklist permissions are no longer exposed to account roles',()=>{const s=read('public/index.html');const block=s.match(/const HR_ATTENDANCE_PERMISSIONS=\[[\s\S]*?\];/)[0];assert.match(block,/hr_admin_manage/);for(const p of ['attendance_view_all','attendance_manage_rules','attendance_manage'])assert.doesNotMatch(block,new RegExp(p));});
