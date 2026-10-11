const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const validator=fs.readFileSync(path.join(root,'public/pxl-urg-0018-account-permission-explicit-override.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

test('account permission validator treats technician service_center parent as expected',()=>{
  assert.match(validator,/const editRole=.*edit-role[\s\S]*if\(editRole==='technician'\|\|values\.some[\s\S]*startsWith\('service_'\)[\s\S]*values\.push\('service_center'\)/);
});

test('account permission validator asset is cache-busted for Project MR save hotfix',()=>{
  assert.match(index,/pxl-urg-0018-account-permission-explicit-override\.js\?v=PXL-VNEXT-3B2A/);
});
