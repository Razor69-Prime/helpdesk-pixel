const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','db-core.js'),'utf8');
function block(start,end){const a=src.indexOf(start);assert.notEqual(a,-1,'missing '+start);const b=src.indexOf(end,a+start.length);return src.slice(a,b<0?src.length:b)}
test('db-core exposes Project photo adapters with active default and atomic RPC',()=>{
  const b=block('// PXL-STG-0011 — PROJECT REPORT DETAIL BOQ','// ─────────────────────────────────────────\n//  SUPPLIERS');
  for(const name of ['getProjectReportItemPhotos','getProjectReportItemPhoto','insertProjectReportItemPhoto','softDeleteProjectReportItemPhoto','getProjectReportAchievementPhotoLinks','createProjectReportItemAchievementWithPhotos']) assert.match(b,new RegExp('async function '+name+'\\b'));
  assert.match(b,/project_report_item_photos/);
  assert.match(b,/deleted_at=is\.null/);
  assert.match(b,/includeDeleted/);
  assert.match(b,/project_report_achievement_photos/);
  assert.match(b,/\/rpc\/pxl_vnext_3d_create_project_achievement_with_photos/);
  assert.match(b,/p_photo_ids:photoIds/);
  const exp=block('module.exports = {','};');
  for(const name of ['getProjectReportItemPhotos','getProjectReportItemPhoto','insertProjectReportItemPhoto','softDeleteProjectReportItemPhoto','getProjectReportAchievementPhotoLinks','createProjectReportItemAchievementWithPhotos']) assert.match(exp,new RegExp('\\b'+name+'\\b'));
});
