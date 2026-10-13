const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
function route(){const a=src.indexOf("app.post('/api/project-report-items/:id/achievements'");assert.notEqual(a,-1);const b=src.indexOf("app.patch('/api/project-report-item-achievements/:id'",a);return src.slice(a,b)}
test('Input Today requires same-item active photo evidence and uses atomic adapter',()=>{
  const r=route();
  assert.match(r,/normalizePhotoIds\(req\.body\.photo_ids\)/);
  assert.match(r,/if\(!photoIds\.length\).*Minimal 1 foto/s);
  assert.match(r,/getProjectReportItemPhotos\(\{itemId:item\.id\}\)/);
  assert.match(r,/validateProjectPhotoEvidence\(\{itemId:item\.id,photoIds,photos\}\)/);
  assert.match(r,/createProjectReportItemAchievementWithPhotos\(\{/);
  assert.doesNotMatch(r,/db\.insertProjectReportItemAchievement\(/);
});
test('3C and BOQ validations remain before photo atomic write',()=>{
  const r=route();
  const boq=r.indexOf('done+achievement>boq');
  const ledger=r.indexOf('checkProjectMaterialUsage');
  const evidence=r.indexOf('validateProjectPhotoEvidence');
  const rpc=r.indexOf('createProjectReportItemAchievementWithPhotos');
  assert.ok(boq>=0&&ledger>=0&&evidence>=0&&rpc>=0);
  assert.ok(boq<evidence && ledger<evidence && evidence<rpc);
  assert.match(r,/getFreshProjectMaterialUsageState\(item\)/);
});
