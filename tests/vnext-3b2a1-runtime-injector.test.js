const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const compat=fs.readFileSync(path.join(root,'pxl-stg-0004f.js'),'utf8');

test('runtime index injector serves the Project MR permission validator with the 3B2A cache key',()=>{
  assert.match(compat,/pxl-urg-0018-account-permission-explicit-override\.js\?v=PXL-VNEXT-3B2A/);
  assert.doesNotMatch(compat,/pxl-urg-0018-account-permission-explicit-override\.js\?v=PXL-URG-0082/);
});
