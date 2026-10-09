const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('public/pxl-vnext-3a-project-detail.js','utf8');

function fn(name,nextName){
  const start=src.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} missing`);
  const end=nextName?src.indexOf(`\n  function ${nextName}(`,start+1):src.indexOf('\n  function ',start+20);
  return src.slice(start,end<0?src.length:end);
}

test('Gantt template controls are permission-gated and available in Gantt editor',()=>{
  assert.match(src,/Simpan Sebagai Template/);
  assert.match(src,/Pakai Template/);
  assert.match(src,/hasPermission\('project_gantt_manage'\)/);
  assert.match(src,/loadGanttTemplates/);
});

test('saveCurrentGanttAsTemplate sends only template name and stage layout',()=>{
  const block=fn('saveCurrentGanttAsTemplate','applyGanttTemplate');
  assert.match(block,/api\('POST','\/project-gantt-templates'/);
  assert.match(block,/name/);
  assert.match(block,/duration_days/);
  assert.match(block,/sort_order/);
  assert.doesNotMatch(block,/start_date\s*:/);
  assert.doesNotMatch(block,/project_id\s*:/);
});

test('applyGanttTemplate keeps current project start date and never auto-saves project plan',()=>{
  const block=fn('applyGanttTemplate','renderGanttRows');
  assert.match(block,/state\.ganttStartDate/);
  assert.match(block,/state\.ganttStages\s*=/);
  assert.match(block,/state\.data\?\.gantt_plan\?\.stages\?\.length|state\.data\.gantt_plan/);
  assert.match(block,/confirm\(/);
  assert.doesNotMatch(block,/api\('PUT',[^\n]*gantt-plan/);
  assert.doesNotMatch(block,/saveGanttPlan\(/);
});

test('Simpan Gantt Plan remains the explicit project-plan persistence action',()=>{
  const save=fn('saveGanttPlan','downloadGanttPdf');
  assert.match(save,/api\('PUT',`\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/gantt-plan`/);
  const apply=fn('applyGanttTemplate','renderGanttRows');
  assert.doesNotMatch(apply,/\/gantt-plan/);
});
