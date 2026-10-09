const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('public/index.html','utf8');
const prefill=fs.readFileSync('public/pxl-vnext-2c-survey-so-prefill.js','utf8');
const so=fs.readFileSync('public/sales-order.html','utf8');

test('cancelled WO status select renders canonical Cancelled state instead of falling back to Assigned',()=>{
  assert.match(index,/const isCancelledStatus=.*t\.status.*cancelled/);
  assert.match(index,/option value="cancelled"[^>]*selected[^>]*>[^<]*Cancelled/);
  assert.match(index,/isCancelledStatus\?'disabled'/);
});

test('Survey to SO prefill calls the actual protected API endpoint',()=>{
  assert.match(prefill,/api\('GET',`\/api\/tickets\/\$\{encodeURIComponent\(surveyTicketId\)\}\/survey-sales-order-draft`\)/);
  assert.doesNotMatch(prefill,/api\('GET',`\/tickets\/\$\{encodeURIComponent\(surveyTicketId\)\}\/survey-sales-order-draft`\)/);
});

test('Sales Order cache-busts the corrected Survey prefill script',()=>{
  assert.match(so,/pxl-vnext-2c-survey-so-prefill\.js\?v=PXL-URG-\d+/);
});
