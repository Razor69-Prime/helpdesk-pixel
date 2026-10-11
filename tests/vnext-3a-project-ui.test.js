const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const report=fs.readFileSync(path.join(root,'public/pxl-stg-0016-project-report.js'),'utf8');
const detailPath=path.join(root,'public/pxl-vnext-3a-project-detail.js');

function detailSource(){
  assert.equal(fs.existsSync(detailPath),true,'Project Detail module must exist');
  return fs.readFileSync(detailPath,'utf8');
}

test('Project permissions add Gantt and Primary WO management without changing Manager BOQ default',()=>{
  assert.match(index,/project_gantt_manage/);
  assert.match(index,/project_primary_wo_manage/);
  assert.match(index,/const projectDefaults=role==='superadmin'\?PROJECT_PERMISSIONS\.map\(x=>x\.id\):role==='manager'\?\['project_boq_manage'\]:\[\]/);
});

test('Project Tracker rows expose native Detail action and keep Edit Delete actions',()=>{
  assert.match(index,/pxlProjectVnext3A\.open\('\$\{p\.id\}'\)/);
  assert.match(index,/editProject\('\$\{p\.id\}'\)/);
  assert.match(index,/deleteProject\('\$\{p\.id\}'\)/);
});

test('Project Detail retains Phase 3A tabs and adds approved Phase 3B Material Request tab',()=>{
  const src=detailSource();
  for(const pattern of [/Overview/,/BOQ &(?:amp;)? Report/,/Gantt Chart/,/Work Order/,/Material Request/]) assert.match(src,pattern);
  for(const future of ['Documents','SPJ']) assert.doesNotMatch(src,new RegExp(`>${future}<`));
  assert.match(src,/window\.pxlProjectVnext3A/);
  assert.match(src,/open:open/);
  assert.match(src,/refresh:refresh/);
});

test('Project Detail Overview reuses existing project/report data and BOQ is read-only',()=>{
  const src=detailSource();
  assert.match(src,/\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/detail/);
  assert.match(src,/material_summary/);
  assert.match(src,/jasa_summary/);
  assert.match(src,/primary_work_order/);
  assert.match(src,/gantt_plan/);
  assert.match(src,/Kelola BOQ/);
  assert.match(src,/openBoqProject/);
  assert.doesNotMatch(src,/POST[^\n]*project-reports|PUT[^\n]*project-reports/,'Detail module must not create a second BOQ write path');
});

test('existing Project Report exposes direct BOQ handoff helper',()=>{
  assert.match(report,/async function openBoqProject\(projectId\)/);
  assert.match(report,/boqProjectId=String\(projectId\)/);
  assert.match(report,/openBoqProject/);
});

test('Project Detail script remains explicitly cache-busted after Phase 3A1',()=>{
  assert.match(index,/pxl-vnext-3a-project-detail\.js\?v=PXL-(?:VNEXT-3A(?:1|2)|URG-\d+)/);
});
