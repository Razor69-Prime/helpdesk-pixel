const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=p=>fs.readFileSync(p,'utf8');
const server=read('server.js');
const salesOrder=read('public/sales-order.html');
const prefill=read('public/pxl-vnext-2c-survey-so-prefill.js');

function fn(src,name,next){
  const start=src.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} missing`);
  const end=next?src.indexOf(`\n  function ${next}(`,start+1):src.indexOf('\n  function ',start+20);
  return src.slice(start,end<0?src.length:end);
}

test('0109 migration aligns tickets status constraint with cancelled while preserving legacy cancel',()=>{
  assert.equal(fs.existsSync('PXL-URG-0109-MIGRATION.sql'),true,'0109 migration must exist');
  const sql=read('PXL-URG-0109-MIGRATION.sql');
  assert.match(sql,/drop constraint if exists tickets_status_check/i);
  assert.match(sql,/add constraint tickets_status_check/i);
  assert.match(sql,/\bcancelled\b/i);
  assert.match(sql,/\bcancel\b/i);
  assert.doesNotMatch(sql,/\b(update|insert\s+into|delete\s+from)\s+(public\.)?tickets\b/i,'migration must not rewrite ticket rows');
});

test('cancel WO endpoint continues to write canonical cancelled status and audit history',()=>{
  const start=server.indexOf("app.post('/api/tickets/:id/cancel'");
  assert.ok(start>=0,'cancel endpoint missing');
  const end=server.indexOf('\napp.',start+5);
  const block=server.slice(start,end<0?server.length:end);
  assert.match(block,/status:'cancelled'/);
  assert.match(block,/cancelled_at/);
  assert.match(block,/cancelled_by/);
  assert.match(block,/cancel_reason/);
  assert.match(block,/insertStatusHistory\([^\n]*status:'cancelled'/s);
});

test('Sales Order exposes an explicit readiness promise that resolves after load and reset',()=>{
  assert.match(salesOrder,/pxl-vnext-2c-survey-so-prefill\.js\?v=PXL-URG-\d+/);
  assert.match(salesOrder,/window\.pxlSalesOrderReady\s*=/);
  assert.match(salesOrder,/window\.pxlSalesOrderReady[\s\S]{0,180}reset\(\)/);
});

test('Survey to SO prefill waits on Sales Order readiness and no longer depends on removed urgent patch flag',()=>{
  const wait=fn(prefill,'waitReady','ensureNotice');
  assert.match(wait,/window\.pxlSalesOrderReady/);
  assert.match(wait,/await\s+window\.pxlSalesOrderReady/);
  assert.doesNotMatch(wait,/__pxlUrg0021c/);
  assert.match(wait,/typeof addMaterial==='function'/);
  assert.match(wait,/typeof addService==='function'/);
});

test('Survey prefill still maps customer, project, maps, material, jasa and source ticket into existing SO form',()=>{
  const block=fn(prefill,'prefillSurvey','focusExisting');
  for(const token of ['customer_name','customer_phone','project_name','google_maps_url','data.materials','data.services','wrapCollect']) assert.match(block,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  const collect=fn(prefill,'wrapCollect','prefillSurvey');
  assert.match(collect,/survey_source_ticket_id/);
  assert.match(collect,/survey_source_wo_number/);
});
