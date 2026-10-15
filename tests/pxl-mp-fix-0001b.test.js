const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const menu=fs.readFileSync('public/pxl-urg-0040-master-pricelist-menu.js','utf8');
const legacy=fs.readFileSync('public/master-pricelist-0050.html','utf8');
const loader=fs.readFileSync('public/pxl-urg-0038c-wa-customer.js','utf8');

test('Master Pricelist menu opens only canonical fixed page',()=>{
  assert.match(menu,/master-pricelist\.html\?v=PXL-MP-FIX-0001B/);
  assert.doesNotMatch(menu,/master-pricelist-0050\.html/);
});

test('legacy 0050 page can no longer run old sync parser and redirects to canonical page',()=>{
  assert.match(legacy,/master-pricelist\.html\?v=PXL-MP-FIX-0001B/);
  assert.doesNotMatch(legacy,/function parse\(/);
  assert.doesNotMatch(legacy,/api\/master-pricelist\/sync/);
});

test('Master Pricelist loader cache-busts the canonical menu fix',()=>{
  assert.match(loader,/pxl-urg-0040-master-pricelist-menu\.js\?v=PXL-MP-FIX-0001B/);
});
