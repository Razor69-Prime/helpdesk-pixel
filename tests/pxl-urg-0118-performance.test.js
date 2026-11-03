const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('MR list compactor removes large signatures but preserves flags',()=>{
  const mod=require('../pxl-urg-0118-performance-api');
  const rows=mod.compactMrRows([{id:'1',requester_signature:'data:abc',technician_signature:'data:def',prepared_signature:'data:ghi',items:[{name:'x'}]}]);
  assert.equal(rows[0].requester_signature,undefined);
  assert.equal(rows[0].technician_signature,undefined);
  assert.equal(rows[0].prepared_signature,undefined);
  assert.equal(rows[0].has_requester_signature,true);
  assert.equal(rows[0].has_technician_signature,true);
  assert.equal(rows[0].has_prepared_signature,true);
  assert.deepEqual(rows[0].items,[{name:'x'}]);
});

test('isolated static hook injects performance loader and optimizes legacy PDF SO source',()=>{
  const mod=require('../pxl-urg-0118-performance-api');
  assert.match(mod.injectPerformanceLoader('<html><body>x</body></html>'),/pxl-urg-0118-performance\.js\?v=PXL-URG-0118/);
  const old="async function getSalesOrders(){const report=await json('/api/crm/report');return Array.isArray(report.sales_orders)?report.sales_orders:[];}";
  const optimized=mod.optimizeLegacyPdfAsset(old);
  assert.match(optimized,/json\('\/api\/sales-orders'\)/);
  assert.doesNotMatch(optimized,/api\/crm\/report/);
});

test('frontend performance module restores 5 minute notifications and dashboard autoload',()=>{
  const src=fs.readFileSync(path.join(root,'public/pxl-urg-0118-performance.js'),'utf8');
  assert.match(src,/5\*60\*1000/);
  assert.match(src,/PXL_URG_0066\.refresh/);
  assert.match(src,/allowDashboardRefresh/);
  assert.match(src,/\/material-requests-form/);
});