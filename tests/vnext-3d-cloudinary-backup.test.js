const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const libSrc=fs.readFileSync(path.join(__dirname,'..','ops','backup','cloudinary-backup-lib.js'),'utf8');
const backup=fs.readFileSync(path.join(__dirname,'..','ops','backup','cloudinary-backup.js'),'utf8');
const lib=require('../ops/backup/cloudinary-backup-lib');
test('backup lib gives Project photos a separate stable path and evidence date precedence',()=>{
  assert.equal(lib.projectRelativePath({project_number:'PRJ-26-013'},{id:'boq/1'}),path.join('PROJECT','PRJ-26-013','ITEM','boq_1'));
  const d=lib.recordDate({evidence_time:'2026-10-13T01:02:03Z',uploaded_at:'2026-10-14T00:00:00Z'});
  assert.equal(d.toISOString(),'2026-10-13T01:02:03.000Z');
  assert.match(libSrc,/projectRelativePath/);
});
test('backup runner bulk-loads and archives Project item photos without Project PDF generation',()=>{
  assert.match(backup,/db\.getProjects\(\)/);
  assert.match(backup,/db\.getProjectReportItems\(\)/);
  assert.match(backup,/db\.getProjectReportItemPhotos\(\{includeDeleted:true\}\)/);
  assert.match(backup,/projectRelativePath/);
  assert.match(backup,/manifest\.projects/);
  assert.match(backup,/project-item\.json/);
  assert.match(backup,/backupPhotos\(/);
  assert.doesNotMatch(backup,/writeProjectPdf|PROJECT REPORT PDF/i);
  assert.match(backup,/manifest\.work_orders/);
  assert.match(backup,/manifest\.services/);
});
