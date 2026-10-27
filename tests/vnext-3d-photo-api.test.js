const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
function route(method,pathText){const sig=`app.${method}('${pathText}'`;const a=src.indexOf(sig);assert.notEqual(a,-1,'missing '+sig);const b=src.indexOf('\n});',a);return src.slice(a,b+4)}
test('Project photo API has read upload signature metadata and delete routes with locked permissions',()=>{
  const get=route('get','/api/project-report-items/:id/photos');
  assert.match(get,/requireProjectPhotoRead/);
  assert.match(get,/getProjectReportItemPhotos/);
  assert.match(get,/getProjectReportAchievementPhotoLinks/);
  const sig=route('post','/api/project-report-items/:id/photos/signature');
  assert.match(sig,/requireProjectPhotoUpload/);
  assert.match(sig,/cloudinaryReady/);
  assert.match(sig,/cloudinarySignature/);
  assert.doesNotMatch(sig,/item\.item_name/);
  const post=route('post','/api/project-report-items/:id/photos');
  assert.match(post,/requireProjectPhotoUpload/);
  assert.match(post,/Number\.isFinite\(latitude\)/);
  assert.match(post,/camera.*gallery|gallery.*camera/s);
  assert.match(post,/documentation.*upload|upload.*documentation/s);
  assert.match(post,/project_number_snapshot/);
  assert.match(post,/req\.session\.user\.name/);
  assert.match(post,/destroyCloudinaryImage/);
  const del=route('delete','/api/project-report-items/:id/photos/:photoId');
  assert.match(del,/isProjectPhotoDeleteRole/);
  assert.match(del,/softDeleteProjectReportItemPhoto/);
  assert.doesNotMatch(del,/destroyCloudinaryImage/);
});
test('Project photo helper exists and permissions include Project roles without granting achievement input',()=>{
  assert.match(src,/async function destroyCloudinaryImage\(publicId\)/);
  assert.match(src,/function requireProjectPhotoRead\(req,res,next\)/);
  assert.match(src,/function requireProjectPhotoUpload\(req,res,next\)/);
  assert.match(src,/technician.*manager.*admin.*superadmin|manager.*admin.*superadmin.*technician/s);
  assert.match(src,/isProjectPhotoUploadRole/);
  assert.match(src,/requireProjectAchievementInput/);
});
test('metadata POST binds Cloudinary public id and secure URL to the exact Project item before persistence',()=>{
  const post=route('post','/api/project-report-items/:id/photos');
  assert.match(post,/pixelapps\/project\/\$\{projectKey\}\/\$\{item\.id\}\//);
  assert.match(post,/res\.cloudinary\.com/);
  assert.match(post,/CLOUDINARY_CLOUD_NAME/);
  assert.match(post,/cleanupPublicId/);
  assert.match(post,/e\.statusCode\|\|e\.status/);
});

test('Project-level photo gallery API returns active project photos with source item labels and evidence counts',()=>{
  const get=route('get','/api/projects/:id/photos');
  assert.match(get,/requireProjectPhotoRead/);
  assert.match(get,/getProjectReportItemPhotos\(\{projectId:/);
  assert.match(get,/item_name/);
  assert.match(get,/project_report_item_id/);
  assert.match(get,/getProjectReportAchievementPhotoLinks/);
  assert.match(get,/evidence_count/);
});
