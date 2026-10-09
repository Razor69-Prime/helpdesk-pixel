const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const so=fs.readFileSync('public/sales-order.html','utf8');
const flow=fs.readFileSync('public/pxl-vnext-2c-survey-flow.js','utf8');
const prefill=fs.readFileSync('public/pxl-vnext-2c-survey-so-prefill.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');

test('Sales Order initial readiness waits for an auth token before protected API loading',()=>{
  assert.match(so,/async function waitForSalesOrderToken\(/);
  assert.match(so,/window\.pxlSalesOrderReady=waitForSalesOrderToken\(\)\.then\(/);
});

test('Sales Order load can fail readiness instead of swallowing protected load errors',()=>{
  assert.match(so,/async function load\([^)]*throwOnError/);
  assert.match(so,/if\s*\(throwOnError\)\s*throw error/);
  assert.match(so,/load\([^)]*throwOnError:true[^)]*\)/);
});

test('Survey prefill still uses protected API route and waits for Sales Order readiness',()=>{
  assert.match(prefill,/await window\.pxlSalesOrderReady/);
  assert.match(prefill,/`\/api\/tickets\/\$\{encodeURIComponent\(surveyTicketId\)\}\/survey-sales-order-draft`/);
  assert.match(prefill,/source_ticket_id.*surveyTicketId/);
});

test('Survey to SO opener and script are cache-busted for PXL-URG-0111',()=>{
  assert.match(flow,/sales-order\.html\?v=PXL-URG-0111&\$\{query\}/);
  assert.match(index,/pxl-vnext-2c-survey-flow\.js\?v=PXL-URG-0111/);
  assert.match(so,/pxl-vnext-2c-survey-so-prefill\.js\?v=PXL-URG-0111/);
});
