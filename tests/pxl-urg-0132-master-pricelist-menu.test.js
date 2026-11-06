'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {inject}=require('../pxl-urg-0121-pr-live-load-hook');
const html=()=>fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const script=()=>fs.readFileSync(path.join(root,'public/pxl-urg-0040-master-pricelist-menu.js'),'utf8');

test('0132 injects original Master Pricelist menu into served index alongside PR 0121',()=>{
  const served=inject(html());
  assert.match(served,/pxl-urg-0040-master-pricelist-menu\.js\?v=PXL-URG-0132/);
  assert.match(served,/pxl-urg-0121-pr-live-load\.js\?v=PXL-URG-0121/);
  assert.match(served,/data-pxl-master-pricelist-bootstrap="0132"/);
});

test('0132 no duplicated Master Pricelist scripts or PR loaders',()=>{
  const once=inject(html()),twice=inject(once);
  assert.equal(twice,once);
  assert.equal((twice.match(/\/pxl-urg-0040-master-pricelist-menu\.js/g)||[]).length,1);
  assert.equal((twice.match(/\/pxl-urg-0121-pr-live-load\.js/g)||[]).length,1);
  const prior='<html><body><script src="/pxl-urg-0040-master-pricelist-menu.js?v=PXL-URG-0091"></script></body></html>';
  const kept=inject(prior);
  assert.equal((kept.match(/\/pxl-urg-0040-master-pricelist-menu\.js/g)||[]).length,1);
  assert.match(kept,/PXL-URG-0091/);
});

test('0132 uses existing permission-aware Master Pricelist UI, not extra access grants',()=>{
  const source=script();
  assert.match(source,/function canRead\(\)/);
  assert.match(source,/isSuperadmin\(\)/);
  assert.match(source,/master_pricelist_read/);
  assert.match(source,/master_pricelist_write/);
  assert.match(source,/function ensureMenu\(\)/);
  assert.match(source,/data-pxl-master-pricelist/);
  assert.match(source,/iframe\.src='\/master-pricelist\.html/);
  const patch=fs.readFileSync(path.join(root,'pxl-urg-0121-pr-live-load-hook.js'),'utf8');
  assert.doesNotMatch(patch,/master_pricelist_read\s*\]/);
  assert.match(patch,/patchWoOptionalTechnician/);
  assert.match(patch,/patchWoMenuDateSync/);
  assert.match(patch,/patchWoMobileGrid/);
  assert.match(patch,/patchWoDetail/);
});
