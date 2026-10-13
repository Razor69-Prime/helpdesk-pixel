const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public','pxl-stg-0016-project-report.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public','sw.js'),'utf8');

function block(startText,endText){
  const start=ui.indexOf(startText);assert.notEqual(start,-1,`missing ${startText}`);
  const end=ui.indexOf(endText,start+startText.length);
  return ui.slice(start,end<0?ui.length:end);
}

test('active Project Report asset remains cache-busted after 3D while 3C behavior stays covered',()=>{
  assert.match(index,/pxl-stg-0016-project-report\.js\?v=PXL-VNEXT-3D/);
  assert.match(sw,/const CACHE='pixelapps-inv1-v114'/);
});

test('existing Project Report Input Today and daily report controls remain present',()=>{
  for(const label of ['BOQ','Today','Total Done','Remain','Progress','Status','History','Copy Report WhatsApp','Download PDF']) assert.match(ui,new RegExp(label));
  assert.match(ui,/data-pr12-save-group/);
  assert.match(ui,/saveAchievementGroup/);
  assert.match(ui,/\/project-report-items\/\$\{encodeURIComponent\(row\.id\)\}\/achievements/);
});

test('Material row shows MR Approved Override Available context only for material',()=>{
  const row=block('function reportItemRow','function markDirty');
  assert.match(row,/(?:isMaterial|material)=cat===['"]material['"]/);
  assert.match(row,/MR Approved/);
  assert.match(row,/Override/);
  assert.match(row,/Available(?: for Use)?/);
  assert.match(row,/mr_approved_qty/);
  assert.match(row,/override_qty/);
  assert.match(row,/available_for_use/);
  assert.match(row,/(?:isMaterial|material)\?/);
});

test('Material browser max is min BOQ remain and Available, and blocks when no approved availability',()=>{
  const row=block('function reportItemRow','function markDirty');
  assert.match(row,/Math\.min\((?:n\(i\.remain\)|remain),available\)/);
  assert.match(row,/(?:isMaterial|material)\s*&&\s*available\s*<=\s*0/);
  assert.match(row,/Input Material diblok|MR Approved/i);
  assert.match(row,/max="\$\{(?:maxToday|max)\}"/);
});

test('Jasa remains outside MR limit and has no override action',()=>{
  const row=block('function reportItemRow','function markDirty');
  assert.match(row,/material\?Math\.min\(remain,available\):remain/);
  assert.match(row,/const ledger=material\?/);
  assert.match(row,/role\(\)===['"]superadmin['"]\?`<button[^`]*data-pr12-override/s);
  assert.match(row,/`:'';/);
});

test('only Superadmin receives per-item Override Material control',()=>{
  assert.match(ui,/role\(\)===['"]superadmin['"]/);
  assert.match(ui,/data-pr12-override/);
  assert.match(ui,/Override Material/);
  const detail=block('function renderReportDetail','function reportItemRow');
  assert.match(detail,/data-pr12-override/);
  assert.match(detail,/overrideMaterial/);
});

test('override flow validates qty and reason, confirms, POSTs exact item endpoint and refreshes report',()=>{
  const fn=block('async function overrideMaterial','function markDirty');
  assert.match(fn,/prompt\(/);
  assert.match(fn,/Number\.isFinite\(qty\).*qty<=0/s);
  assert.match(fn,/reason[^\n]*trim\(\)/);
  assert.match(fn,/if\(!reason\)/);
  assert.match(fn,/confirm\(/);
  assert.match(fn,/api\('POST',`\/project-report-items\/\$\{encodeURIComponent\((?:id|itemId)\)\}\/material-overrides`,\{qty,reason\}\)/);
  assert.match(fn,/await loadFull\(\)/);
  assert.match(fn,/renderReportDetail\(\)/);
  assert.doesNotMatch(fn,/unlock.*project|global/i);
});

test('Material save still uses existing achievement endpoint and no alternate usage write endpoint exists',()=>{
  const save=block('async function saveAchievementGroup','function reportLastAchievement');
  assert.match(save,/\/project-report-items\/\$\{encodeURIComponent\(row\.id\)\}\/achievements/);
  assert.doesNotMatch(save,/material-overrides|material-usage|usage-limit/);
});
