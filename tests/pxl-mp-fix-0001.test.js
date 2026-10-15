const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('public/master-pricelist.html','utf8');
const sku=fs.readFileSync('public/pxl-master-sku-map-0001.js','utf8');
const badge=fs.readFileSync('public/pxl-probus-badge-0001.js','utf8');
const mr=fs.readFileSync('public/pxl-stg-0004d.js','utf8');
const survey=fs.readFileSync('public/pxl-vnext-2c-survey-flow.js','utf8');

test('Master Pricelist parser separates SKU, product name, and HPP using labeled columns',()=>{
  assert.match(html,/cols\.map\([^\n]*label/);
  assert.match(html,/PRODUCT NAME \/ CODE/);
  assert.match(html,/NO SKU/);
  assert.match(html,/sku:/);assert.match(html,/name:/);assert.match(html,/price:/);
  assert.match(html,/g\.skuCol!==null&&sku\?g\.skuCol:g\.nameCol/);
  assert.match(html,/Safety block: SKU terdeteksi sebagai nama item/);
});

test('Master Pricelist visibly shows and searches SKU, including cached data enrichment',()=>{
  assert.match(html,/<th>SKU<\/th>/);
  assert.match(html,/x\.name\+' '\+x\.sku/);
  assert.match(html,/esc\(x\.sku\|\|'-'\)/);
  assert.match(html,/PXL_MASTER_SKU_MAP\.skuFor\(x\.source_key\)/);
});

test('shared SKU helper maps Google NO SKU columns onto existing source keys',()=>{
  assert.match(sku,/PRODUCT NAME \/ CODE/);
  assert.match(sku,/NO SKU/);
  assert.match(sku,/source_key/);
  assert.match(sku,/master_sku/);
  assert.match(sku,/async function enrich/);
});

test('SO and MR PROBUS decorator adds visible SKU metadata without changing item identity',()=>{
  assert.match(badge,/master_sku\|\|item\.sku/);
  assert.match(badge,/SKU: '\+sku/);
  assert.match(badge,/isProbus/);
  assert.match(mr,/PXL_MASTER_SKU_MAP\.enrich/);
  assert.match(mr,/displaySku=i\.master_sku\|\|i\.sku/);
});

test('Survey fast search enriches SKU and retains PROBUS badge',()=>{
  assert.match(survey,/PXL_MASTER_SKU_MAP\.enrich/);
  assert.match(survey,/sku:String\(x\.master_sku\|\|x\.sku\|\|''\)/);
  assert.match(survey,/SKU: \$\{esc\(item\.sku\|\|'-'\)\}/);
  assert.match(survey,/probusBadge\(item\)/);
});
