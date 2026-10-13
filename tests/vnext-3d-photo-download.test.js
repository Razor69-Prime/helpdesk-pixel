const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'..','project-vnext-3d.js'),'utf8');
function route(method,p){const sig=`app.${method}('${p}'`;const a=server.indexOf(sig);assert.notEqual(a,-1,'missing '+sig);const b=server.indexOf('\n});',a);return server.slice(a,b+4)}
test('single Project photo download is internal active-only and proxies watermarked URL',()=>{
  const r=route('get','/api/project-report-item-photos/:photoId/download');
  assert.match(r,/requireProjectPhotoRead/);
  assert.match(r,/getProjectReportItemPhoto\(req\.params\.photoId\)/);
  assert.match(r,/photo\.secure_url/);
  assert.match(r,/Content-Disposition|content-disposition/i);
  assert.match(r,/attachment/);
  assert.doesNotMatch(r,/original_url|unwatermarked/i);
});
test('Download All streams zip from active item gallery without temp files or duplicate link rows',()=>{
  const r=route('get','/api/project-report-items/:id/photos/download-all');
  assert.match(r,/requireProjectPhotoRead/);
  assert.match(r,/getProjectReportItemPhotos\(\{itemId:item\.id\}\)/);
  assert.match(r,/archiver\(['"]zip['"]/);
  assert.match(r,/fetch\(photo\.secure_url/);
  assert.match(r,/archive\.append\(remote\.body/);
  assert.doesNotMatch(r,/project_report_achievement_photos|getProjectReportAchievementPhotoLinks/);
  assert.doesNotMatch(r,/writeFileSync|mkdtemp|temp.*zip|\.zip['"]\)/i);
});
test('download filename helpers are filesystem-safe and stable',()=>{
  assert.match(core,/function projectPhotoDownloadFilename\(/);
  assert.match(core,/function projectPhotoZipFilename\(/);
  assert.match(core,/function projectPhotoZipEntryName\(/);
  assert.match(core,/safeProjectPhotoFilename/);
});
