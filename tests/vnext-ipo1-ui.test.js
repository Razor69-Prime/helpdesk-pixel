const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const detail=fs.readFileSync(path.join(root,'public','pxl-vnext-3a-project-detail.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const modulePath=path.join(root,'public','pxl-vnext-internal-po.js');
function mod(){assert.equal(fs.existsSync(modulePath),true,'Internal PO browser module must exist');return fs.readFileSync(modulePath,'utf8');}

test('Project Detail adds Internal PO as final tab and mounts isolated module',()=>{
  assert.match(detail,/data-v3a-tab="material-request"[^>]*>Material Request<\/button>[\s\S]*data-v3a-tab="internal-po"[^>]*>Internal PO<\/button>/);
  assert.match(detail,/pxl-v3a-internal-po-host/);
  assert.match(detail,/window\.pxlProjectInternalPo\.open\(state\.projectId,host\)/);
  const d=index.indexOf('/pxl-vnext-3a-project-detail.js');
  const i=index.indexOf('/pxl-vnext-internal-po.js');
  assert.ok(d>=0&&i>d,'Internal PO asset must load after Project Detail');
});

test('Internal PO renders approved monitoring table columns and project summary controls',()=>{
  const s=mod();
  for(const label of ['No','Nama Barang','Qty PO','Qty Arrived','Satuan','Harga Beli Non-PPN','PPN 11%','Harga Final','Total','Supplier','Status','Issue']) assert.match(s,new RegExp(`>${label}<`));
  for(const label of ['Project ID','Nama Project','Total Harga Beli','Issue Umum','Simpan Perubahan','Riwayat Perubahan']) assert.match(s,new RegExp(label));
  assert.match(s,/overall_status/);
  assert.match(s,/counts/);
});

test('read-only mode hides mutation controls while preserving monitoring view',()=>{
  const s=mod();
  assert.match(s,/can_manage/);
  assert.match(s,/const editable=state\.data\?\.can_manage===true/);
  assert.match(s,/editable\?[^:]+<input|editable\?`<input/s);
  assert.match(s,/if\(!editable\)/);
});

test('dirty draft blocks tab switch and close until user confirms discard',()=>{
  const s=mod();
  assert.match(s,/dirty:false/);
  assert.match(s,/function markDirty\(/);
  assert.match(s,/function canLeave\(\)/);
  assert.match(s,/confirm\([^)]*perubahan Internal PO/i);
  assert.match(s,/state\.dirty=false/);
  assert.match(detail,/pxlProjectInternalPo\?\.canLeave\(\)/);
  assert.match(detail,/state\.activeTab==='internal-po'/);
  assert.match(detail,/function close\(\)[\s\S]*canLeave/);
});

test('single Save PUT keeps failed draft and clears dirty only on success',()=>{
  const s=mod();
  assert.match(s,/api\('PUT',`\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/internal-po`/);
  assert.match(s,/general_issue:state\.draft\.general_issue/);
  assert.match(s,/items:state\.draft\.items/);
  assert.match(s,/state\.dirty=false/);
  const catchStart=s.indexOf('}catch(e){',s.indexOf('async function save'));
  const catchEnd=s.indexOf('async function openHistory',catchStart);
  assert.ok(catchStart>0&&catchEnd>catchStart,'save catch must exist');
  assert.doesNotMatch(s.slice(catchStart,catchEnd),/dirty=false/,'failed save must keep draft dirty');
});

test('Internal PO UI has issue/status classes and never calls Inventory or MR write paths',()=>{
  const s=mod();
  for(const cls of ['pxl-ipo-has-issue','pxl-ipo-status-arrived','pxl-ipo-status-partial','pxl-ipo-status-hold','pxl-ipo-status-cancelled']) assert.match(s,new RegExp(cls));
  assert.doesNotMatch(s,/api\(['"](?:POST|PUT|PATCH|DELETE)['"],['"`]\/(?:inventory|material-requests|project-material|project-report)/i);
});


test('dirty draft also protects browser-level navigation and reload',()=>{
  const s=mod();
  assert.match(s,/function onBeforeUnload\([^)]*\)[\s\S]{0,300}state\.dirty/);
  assert.match(s,/window\.addEventListener\(['"]beforeunload['"],\s*onBeforeUnload\)/);
  assert.match(s,/e\.preventDefault\(\)/);
  assert.match(s,/e\.returnValue\s*=\s*['"]/);
});
