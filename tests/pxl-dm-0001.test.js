const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('marketing reader is transaction read-only and contains no source write statements',()=>{
  const s=read('pxl-dm-marketing-reader.php');
  assert.match(s,/START TRANSACTION READ ONLY/i);
  assert.match(s,/SELECT[\s\S]+kpi_records/i);
  assert.match(s,/SELECT[\s\S]+meta_ad_campaigns/i);
  assert.match(s,/SELECT[\s\S]+prospect_summaries/i);
  assert.doesNotMatch(s,/\b(INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|ALTER|DROP|CREATE)\b\s+(INTO\s+|TABLE\s+)?(?:`?kpi_records|`?meta_ad_campaigns|`?prospect_summaries)/i);
});

test('unauthorized Digital Marketing guard sends once and stops handler flow',()=>{
  const api=read('pxl-dm-0001-api.js');
  assert.match(api,/if\(!u\)\{res\.status\(401\)\.json\(\{error:'Unauthorized'\}\);return null\}/);
  assert.match(api,/superadmin[\s\S]*res\.status\(403\)[\s\S]*return null/);
});

test('snapshot API exposes local-only snapshot routes and 04:00 WITA scheduler',()=>{
  const s=read('pxl-dm-0001-api.js');
  assert.match(s,/\/api\/digital-marketing\/snapshots/);
  assert.match(s,/\/api\/digital-marketing\/pull/);
  assert.match(s,/Asia\/Makassar/);
  assert.match(s,/04:00/);
  assert.match(s,/digital_marketing_snapshots/);
  assert.match(s,/digital_marketing_pull_history/);
});

test('scheduler is process-wide single instance even when express.static is mounted more than once',()=>{
  const api=read('pxl-dm-0001-api.js');
  assert.match(api,/Symbol\.for\('pxl\.dm\.0001\.scheduler'\)/);
  assert.doesNotMatch(api,/let scheduled=false/);
});

test('server wrapper injects Digital Marketing loader without modifying raw index.html',()=>{
  const api=read('pxl-dm-0001-api.js');
  assert.match(api,/pxl-dm-0001\.js\?v=PXL-DM-0001B/);
  assert.match(api,/pathname==='\/'\|\|pathname==='\/index\.html'/);
  const html=read('public/index.html');
  assert.doesNotMatch(html,/pxl-dm-0001\.js/);
});

test('UI follows PixelApps canonical auth token and currentUser fallbacks',()=>{
  const s=read('public/pxl-dm-0001.js');
  assert.match(s,/pixel_token/);
  assert.match(s,/pxl_token/);
  assert.match(s,/authToken/);
  assert.match(s,/__pxlAuthToken/);
  assert.match(s,/window\.currentUser/);
});

test('UI identifies Marketing Apps as READ ONLY and never calls AI endpoints',()=>{
  const s=read('public/pxl-dm-0001.js');
  assert.match(s,/Digital Marketing/);
  assert.match(s,/READ ONLY/);
  assert.match(s,/Tarik Data Sekarang/);
  assert.doesNotMatch(s,/\/api\/ai\//);
});
