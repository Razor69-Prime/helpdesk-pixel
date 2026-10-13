const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizePhotoIds,validateProjectPhotoEvidence,isProjectPhotoUploadRole,isProjectPhotoDeleteRole,safeProjectPhotoFilename}=require('../project-vnext-3d');

test('normalizePhotoIds trims deduplicates and removes blanks',()=>{
  assert.deepEqual(normalizePhotoIds(['a','a',' b ','']),['a','b']);
});
test('validateProjectPhotoEvidence accepts only active same-item photos',()=>{
  assert.equal(validateProjectPhotoEvidence({itemId:'i1',photoIds:['p1'],photos:[{id:'p1',project_report_item_id:'i1',deleted_at:null}]}).ok,true);
  assert.equal(validateProjectPhotoEvidence({itemId:'i1',photoIds:['p1','p2'],photos:[{id:'p1',project_report_item_id:'i1',deleted_at:null},{id:'p2',project_report_item_id:'i2',deleted_at:null}]}).ok,false);
  assert.equal(validateProjectPhotoEvidence({itemId:'i1',photoIds:['p1'],photos:[{id:'p1',project_report_item_id:'i1',deleted_at:'2026-01-01'}]}).ok,false);
});
test('project photo roles and safe filename are constrained',()=>{
  assert.equal(isProjectPhotoUploadRole('technician'),true);
  assert.equal(isProjectPhotoUploadRole('sales'),false);
  assert.equal(isProjectPhotoDeleteRole('technician'),false);
  assert.equal(isProjectPhotoDeleteRole('admin'),true);
  assert.equal(safeProjectPhotoFilename('PRJ 26/013 foto'), 'PRJ_26_013_foto');
});
