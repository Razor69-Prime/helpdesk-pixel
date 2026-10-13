const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-stg-0016-project-report.js'),'utf8');
function block(a,b){const i=src.indexOf(a);assert.notEqual(i,-1,'missing '+a);const j=src.indexOf(b,i+a.length);return src.slice(i,j<0?src.length:j)}
test('Project Report renders per-item photo action and keeps selected evidence per item',()=>{
  assert.match(src,/selectedPhotoIdsByItem/);
  const row=block('function reportItemRow','async function overrideMaterial');
  assert.match(row,/📷 Foto/);
  assert.match(row,/data-pr12-photo=/);
  const detail=block('function renderReportDetail','function reportItemRow');
  assert.match(detail,/data-pr12-photo/);
  assert.match(detail,/openItemPhotos/);
  const openPhoto=block('function openItemPhotos','function markDirty');
  assert.match(openPhoto,/PXLProjectPhotos\.open/);
  assert.match(openPhoto,/selectedPhotoIds/);
  assert.match(openPhoto,/onSelectionChange/);
});
test('Input Today requires selected evidence per row and posts photo_ids independently',()=>{
  const save=block('async function saveAchievementGroup','function reportLastAchievement');
  assert.match(save,/selectedPhotoIdsByItem\.get\(String\(id\)\)/);
  assert.match(save,/photoIds\.length/);
  assert.match(save,/photo_ids:row\.photoIds/);
  assert.match(save,/selectedPhotoIdsByItem\.delete\(String\(row\.id\)\)/);
  assert.match(save,/for\(const row of valid\)/);
});
test('WhatsApp and PDF flows remain independent of photo state',()=>{
  const wa=block('async function copyDailyReport','function downloadDailyReportPdf');
  const pdf=block('function downloadDailyReportPdf','function toggleHistory');
  assert.doesNotMatch(wa,/selectedPhotoIdsByItem|PXLProjectPhotos|photo_ids/);
  assert.doesNotMatch(pdf,/selectedPhotoIdsByItem|PXLProjectPhotos|photo_ids/);
});

test('Manager and Admin can use photo gallery while Input Today remains Technician/Superadmin only',()=>{
  assert.match(src,/const canReport=\(\)=>\[[^\]]*technician[^\]]*manager[^\]]*admin[^\]]*superadmin[^\]]*\]/);
  assert.match(src,/const canAchievement=\(\)=>\[[^\]]*technician[^\]]*superadmin[^\]]*\]/);
  const row=block('function reportItemRow','async function overrideMaterial');
  assert.match(row,/canAchievement\(\)/);
  const detail=block('function renderReportDetail','function reportItemRow');
  assert.match(detail,/canAchievement\(\)/);
});
