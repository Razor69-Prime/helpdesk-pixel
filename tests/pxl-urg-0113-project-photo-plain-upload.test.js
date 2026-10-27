const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const photos=fs.readFileSync(path.join(root,'public','pxl-vnext-3d-project-photos.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public','sw.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'PXL-URG-0113-MIGRATION.sql'),'utf8');

function fnBlock(name,nextName){
  const a=photos.indexOf(`async function ${name}`);assert.notEqual(a,-1,`missing ${name}`);
  const b=photos.indexOf(`async function ${nextName}`,a+1);assert.notEqual(b,-1,`missing ${nextName}`);
  return photos.slice(a,b);
}
function serverRoute(){
  const a=server.indexOf("app.post('/api/project-report-items/:id/photos'");assert.notEqual(a,-1);
  const b=server.indexOf('\n});',a);return server.slice(a,b+4);
}

test('Project photo upload temporarily skips GPS, reverse geocode, and watermark rendering',()=>{
  const upload=fnBlock('processAndUpload','uploadFiles');
  assert.doesNotMatch(upload,/currentGps\s*\(/);
  assert.doesNotMatch(upload,/reverseGeocode\s*\(/);
  assert.doesNotMatch(upload,/renderWatermarked\s*\(/);
  assert.match(upload,/renderPlainImage\s*\(/);
  assert.match(upload,/latitude:null,longitude:null/);
  assert.match(upload,/address_text:'GPS dinonaktifkan'/);
  assert.match(upload,/source==='camera'\?'documentation':'upload'/);
});

test('database migration clears disabled GPS sentinel instead of storing fake coordinates',()=>{
  const post=serverRoute();
  assert.match(post,/const latitude=Number\(req\.body\.latitude\),longitude=Number\(req\.body\.longitude\)/);
  assert.match(migration,/alter column latitude drop not null/i);
  assert.match(migration,/alter column longitude drop not null/i);
  assert.match(migration,/new\.address_text='GPS dinonaktifkan'/i);
  assert.match(migration,/new\.latitude:=null/i);
  assert.match(migration,/new\.longitude:=null/i);
  assert.match(migration,/before insert or update/i);
});

test('Project photo UI no longer asks for GPS and service worker forces fresh plain-photo asset',()=>{
  assert.doesNotMatch(photos,/id="pxl3d-gps-retry"/);
  assert.doesNotMatch(photos,/GPS wajib untuk semua foto Project/);
  assert.match(photos,/Foto akan diunggah tanpa watermark dan tanpa GPS/);
  assert.match(photos,/revision:'PXL-URG-0115'/);
  assert.match(index,/pxl-vnext-3d-project-photos\.js\?v=PXL-URG-0115/);
  assert.match(sw,/replace\('\/pxl-vnext-3d-project-photos\.js\?v=PXL-VNEXT-3D2','\/pxl-vnext-3d-project-photos\.js\?v=PXL-URG-0115'\)/);
  assert.match(sw,/url\.pathname==='\/pxl-vnext-3d-project-photos\.js'/);
  assert.match(sw,/networkFirstAsset\(request\)/);
});
