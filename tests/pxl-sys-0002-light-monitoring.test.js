const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'public','pxl-urg-0076-system-tools.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const cronPath=path.join(root,'ops','backup','pixelapps-cron.conf');
const cron=fs.existsSync(cronPath)?fs.readFileSync(cronPath,'utf8'):'';

test('slow request monitor records only requests taking at least five seconds without blocking request flow',()=>{
  assert.match(server,/PXL_SLOW_REQUEST_THRESHOLD_MS\s*=\s*5000/);
  assert.match(server,/PXL_SLOW_REQUEST_LOG[^\n]*pixelapps-slow-requests\.jsonl/);
  assert.match(server,/res\.on\(['"]finish['"]/);
  assert.match(server,/duration_ms[\s\S]{0,300}PXL_SLOW_REQUEST_THRESHOLD_MS/);
  assert.match(server,/fs\.promises\.appendFile\(PXL_SLOW_REQUEST_LOG/);
  assert.doesNotMatch(server,/appendFileSync\(PXL_SLOW_REQUEST_LOG/);
});

test('System Tools returns 24 hour slow request summary and four lightweight health probes',()=>{
  assert.match(server,/function pxlSysSlowRequests\(/);
  assert.match(server,/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(server,/slow_requests/);
  for(const name of ['node_local','nginx_local','postgrest','public_cloudflare']) assert.match(server,new RegExp(name));
  assert.match(server,/https:\/\/internal\.pixelsolusindo\.com\//);
  assert.match(server,/http:\/\/127\.0\.0\.1:3001\//);
  assert.match(server,/http:\/\/127\.0\.0\.1:3003\/rest\/v1\/tickets/);
});

test('System Tools UI shows lightweight monitoring card and recent slow requests',()=>{
  assert.match(ui,/Monitoring Ringan/);
  assert.match(ui,/Slow request 24 jam/);
  assert.match(ui,/Paling lambat/);
  assert.match(ui,/Public Cloudflare/);
  assert.match(ui,/5 kejadian terakhir/);
  assert.match(index,/pxl-urg-0076-system-tools\.js\?v=PXL-SYS-0002/);
});

test('PixelApps daily backup canonical cron runs at 18:15 UTC which is 02:15 WITA next day',()=>{
  assert.equal(fs.existsSync(cronPath),true,'canonical cron file missing');
  assert.match(cron,/^15 18 \* \* \* \/bin\/bash \/var\/www\/internal\.pixelsolusindo\.com\/ops\/backup\/pixelapps-backup\.sh/m);
  assert.doesNotMatch(cron,/CRON_TZ/);
  assert.match(cron,/02:15 WITA/);
});
