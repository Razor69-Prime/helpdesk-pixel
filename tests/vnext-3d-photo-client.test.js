const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const jsPath=path.join(__dirname,'..','public','pxl-vnext-3d-project-photos.js');
const logoPath=path.join(__dirname,'..','public','assets','pxl-vnext-3d-watermark-logo.png');
test('3D photo client owns GPS resize watermark camera gallery and sequential upload',()=>{
  assert.equal(fs.existsSync(jsPath),true,'client module missing');
  const src=fs.readFileSync(jsPath,'utf8');
  assert.match(src,/MAX_DIM\s*=\s*1920/);
  assert.match(src,/JPEG_QUALITY\s*=\s*0\.88/);
  assert.match(src,/navigator\.geolocation\.getCurrentPosition/);
  assert.match(src,/Alamat tidak tersedia/);
  assert.match(src,/capture=["']environment["']/);
  assert.match(src,/multiple/);
  assert.match(src,/Lokasi\/Waktu Dokumentasi/);
  assert.match(src,/Lokasi\/Waktu Upload/);
  assert.match(src,/\/assets\/pxl-vnext-3d-watermark-logo\.png/);
  assert.match(src,/for\s*\(const file of files\)[\s\S]*await processAndUpload/);
  assert.match(src,/window\.PXLProjectPhotos\s*=\s*\{[\s\S]*open[\s\S]*revision:'PXL-VNEXT-3D1'/);
});
test('watermark content excludes project name and BOQ item name',()=>{
  const src=fs.readFileSync(jsPath,'utf8');
  const a=src.indexOf('function watermarkLines');assert.notEqual(a,-1);
  const b=src.indexOf('\n  }',a);const fn=src.slice(a,b+4);
  assert.doesNotMatch(fn,/item_name|nama_project|project\.name|item\.name/);
  assert.match(fn,/project_number|project\.id/);
  assert.match(fn,/latitude|longitude/);
});
test('exact approved Pixel watermark logo exists',()=>{
  assert.equal(fs.existsSync(logoPath),true);
  const sum=crypto.createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex');
  assert.equal(sum,'028b5260ce1dfbee6a42fc9e4e9a984333cb12e0f7798f7193c805bf804488db');
});
test('photo downloads use JWT-authenticated fetch and watermark preview is visible before upload',()=>{
  const src=fs.readFileSync(jsPath,'utf8');
  assert.match(src,/function authToken\(\)/);
  assert.match(src,/Authorization['"]?\s*:\s*['"]Bearer ['"]?\s*\+\s*token|`Bearer \${token}`/);
  assert.match(src,/async function downloadWithAuth\(/);
  assert.match(src,/data-p3d-download/);
  assert.match(src,/data-p3d-download-all/);
  assert.match(src,/id="pxl3d-preview"/);
  assert.match(src,/URL\.createObjectURL\(blob\)/);
});
