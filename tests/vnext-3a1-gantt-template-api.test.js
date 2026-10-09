const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('server.js','utf8');

function route(method,path){
  const start=src.indexOf(`app.${method}('${path}'`);
  assert.ok(start>=0,`${method.toUpperCase()} ${path} missing`);
  const next=src.indexOf('\napp.',start+5);
  return src.slice(start,next<0?src.length:next);
}

test('shared Gantt template GET is Project-read protected and returns DB templates',()=>{
  const block=route('get','/api/project-gantt-templates');
  assert.match(block,/requireRole\(\.\.\.PROJECT_ROLES\)/);
  assert.match(block,/db\.getProjectGanttTemplates\(\)/);
});

test('shared Gantt template POST reuses project_gantt_manage and validates bounded template input',()=>{
  const block=route('post','/api/project-gantt-templates');
  assert.match(block,/requireRole\(\.\.\.PROJECT_ROLES\)/);
  assert.match(block,/requireProjectVnextPermission\('project_gantt_manage'\)/);
  assert.match(block,/name[^\n]*trim/);
  assert.match(block,/120/);
  assert.match(block,/Array\.isArray\([^\n]*stages/);
  assert.match(block,/buildSequentialGanttPlan/);
  assert.match(block,/createProjectGanttTemplate/);
  assert.match(block,/req\.session\.user\.name/);
  assert.doesNotMatch(block,/replaceProjectGanttPlan|project_gantt_plans|project_gantt_stages/);
});

test('template POST strips project dates and normalizes template stage payload',()=>{
  const block=route('post','/api/project-gantt-templates');
  assert.match(block,/duration_days/);
  assert.match(block,/sort_order/);
  assert.doesNotMatch(block,/planned_start\s*:/);
  assert.doesNotMatch(block,/planned_end\s*:/);
  assert.doesNotMatch(block,/start_date\s*:/);
  assert.doesNotMatch(block,/project_id\s*:/);
});
