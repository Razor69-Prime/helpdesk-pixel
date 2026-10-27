const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const jsPath=path.join(__dirname,'..','public','pxl-vnext-3d-project-photos.js');
const logoPath=path.join(__dirname,'..','public','assets','pxl-vnext-3d-watermark-logo.png');
test('3D photo client uses resize-only camera/gallery sequential upload while watermark and GPS are disabled',()=>{
  assert.equal(fs.existsSync(jsPath),true,'client module missing');
  const src=fs.readFileSync(jsPath,'utf8');
  assert.match(src,/MAX_DIM\s*=\s*1920/);
  assert.match(src,/JPEG_QUALITY\s*=\s*0\.88/);
  assert.doesNotMatch(src,/navigator\.geolocation\.getCurrentPosition/);
  assert.doesNotMatch(src,/renderWatermarked/);
  assert.match(src,/renderPlainImage/);
  assert.match(src,/capture=["']environment["']/);
  assert.match(src,/multiple/);
  assert.match(src,/for\s*\(const file of files\)[\s\S]*await processAndUpload/);
  assert.match(src,/window\.PXLProjectPhotos\s*=\s*\{[\s\S]*open[\s\S]*revision:'PXL-URG-0115'/);
});
test('plain photo renderer resizes and encodes JPEG without adding overlay text',()=>{
  const src=fs.readFileSync(jsPath,'utf8');
  const a=src.indexOf('async function renderPlainImage');assert.notEqual(a,-1);
  const b=src.indexOf('async function processAndUpload',a);const fn=src.slice(a,b);
  assert.match(fn,/drawImage\(img,0,0,w,h\)/);
  assert.match(fn,/toBlob/);
  assert.doesNotMatch(fn,/fillText|fillRect|watermark|GPS:/i);
});
test('exact approved Pixel watermark logo remains available for future re-enable',()=>{
  assert.equal(fs.existsSync(logoPath),true);
  const sum=crypto.createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex');
  assert.equal(sum,'028b5260ce1dfbee6a42fc9e4e9a984333cb12e0f7798f7193c805bf804488db');
});
test('photo downloads use JWT-authenticated fetch and plain preview is visible before upload',()=>{
  const src=fs.readFileSync(jsPath,'utf8');
  assert.match(src,/function authToken\(\)/);
  assert.match(src,/Authorization['"]?\s*:\s*['"]Bearer ['"]?\s*\+\s*token|`Bearer \${token}`/);
  assert.match(src,/async function downloadWithAuth\(/);
  assert.match(src,/data-p3d-download/);
  assert.match(src,/data-p3d-download-all/);
  assert.match(src,/id="pxl3d-preview"/);
  assert.match(src,/URL\.createObjectURL\(blob\)/);
});
test('Project gallery loads photo pixels through authenticated same-origin endpoint instead of direct Cloudinary img src',()=>{
  const src=fs.readFileSync(jsPath,'utf8');
  assert.match(src,/async function projectPhotoBlobUrl\(/);
  assert.match(src,/\/api\/project-report-item-photos\/\$\{encodeURIComponent\(photoId\)\}\/download/);
  assert.match(src,/data-p3d-photo-id/);
  assert.doesNotMatch(src,/<img src="\$\{esc\(p\.secure_url\)\}"/);
});

test('photo modal keeps current-item evidence flow but also renders other Project photos inside the same modal',()=>{
  const src=fs.readFileSync(jsPath,'utf8');
  assert.match(src,/\/projects\/\$\{encodeURIComponent\(ctxState\.project\.id\)\}\/photos/);
  assert.match(src,/Dokumentasi Project/);
  assert.match(src,/project_report_item_id/);
  assert.match(src,/item_name/);
  assert.match(src,/data-p3d-project-photo/);
  assert.match(src,/String\(p\.project_report_item_id\).*String\(ctxState\.item\.id\)/s);
  assert.doesNotMatch(src,/data-p3d-project-photo[\s\S]{0,180}data-p3d-select/);
});
