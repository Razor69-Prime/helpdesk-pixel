const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public','sw.js'),'utf8');
const detail=fs.readFileSync(path.join(root,'public','pxl-vnext-3a-project-detail.js'),'utf8');

test('IPO1 browser module is cache-busted and loaded after current Project Detail',()=>{
  const detailTag='/pxl-vnext-3a-project-detail.js?v=PXL-VNEXT-IPO1';
  const ipoTag='/pxl-vnext-internal-po.js?v=PXL-VNEXT-IPO1';
  const a=index.indexOf(detailTag),b=index.indexOf(ipoTag);
  assert.ok(a>=0,'Project Detail must be cache-busted for IPO1 changes');
  assert.ok(b>a,'Internal PO module must load after Project Detail');
  assert.match(detail,/const REV='PXL-VNEXT-IPO1'/);
});

test('service worker bumps cache and serves changed Project Detail/Internal PO assets network-first',()=>{
  assert.match(sw,/const CACHE='pixelapps-inv1-v118'/);
  assert.match(sw,/pxl-vnext-3a-project-detail\.js/);
  assert.match(sw,/pxl-vnext-internal-po\.js/);
  assert.match(sw,/networkFirstAsset\(request\)/);
  assert.match(sw,/url\.pathname===['"]\/pxl-vnext-3a-project-detail\.js['"]/);
  assert.match(sw,/url\.pathname===['"]\/pxl-vnext-internal-po\.js['"]/);
});

test('legacy 3D photo and Project MR hotfix cache keys remain untouched',()=>{
  assert.match(index,/pxl-vnext-3d-project-photos\.js\?v=PXL-VNEXT-3D2/);
  assert.match(index,/pxl-vnext-3b-project-mr\.js\?v=PXL-VNEXT-3D4/);
  assert.match(index,/pxl-stg-0016-project-report\.js\?v=PXL-VNEXT-3D/);
});

test('IPO1 wiring contains no backups or download asset references',()=>{
  assert.doesNotMatch(index,/backups\/PXL-VNEXT-IPO1|public\/downloads\/PXL-VNEXT-IPO1/);
  assert.doesNotMatch(sw,/backups\/PXL-VNEXT-IPO1|public\/downloads\/PXL-VNEXT-IPO1/);
});
