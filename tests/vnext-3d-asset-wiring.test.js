const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','public','sw.js'),'utf8');
test('3D photo client loads before active Project Report with 3D cache busting',()=>{
  const photo=index.indexOf('/pxl-vnext-3d-project-photos.js?v=PXL-VNEXT-3D2');
  const report=index.indexOf('/pxl-stg-0016-project-report.js?v=PXL-VNEXT-3D');
  assert.ok(photo>=0&&report>=0&&photo<report);
});
test('service worker v118 caches 3D2 module/logo and keeps API bypass',()=>{
  assert.match(sw,/const CACHE='pixelapps-inv1-v118'/);
  assert.match(sw,/\/pxl-vnext-3d-project-photos\.js/);
  assert.match(sw,/\/assets\/pxl-vnext-3d-watermark-logo\.png/);
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\).*return/);
});
