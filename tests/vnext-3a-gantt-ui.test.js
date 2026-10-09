const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-3a-project-detail.js'),'utf8');

test('Gantt editor loads authoritative API plan/defaults and defaults only when no stored plan',()=>{
  assert.match(src,/\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/gantt-plan/);
  assert.match(src,/default_stages/);
  assert.match(src,/result\.plan/);
  assert.match(src,/!result\.plan/);
});

test('Gantt management is permission-gated and editor supports all approved stage operations',()=>{
  assert.match(src,/hasPermission\('project_gantt_manage'\)/);
  for(const label of ['Project Start Date','Tambah Tahap','Simpan Gantt Plan']) assert.match(src,new RegExp(label));
  assert.match(src,/moveGanttStage/);
  assert.match(src,/removeGanttStage/);
  assert.match(src,/addGanttStage/);
  assert.match(src,/state\.ganttStages\.length>=100/);
});

test('browser Gantt preview uses UTC calendar-day arithmetic and integer duration validation',()=>{
  assert.match(src,/Date\.UTC/);
  assert.match(src,/24\*60\*60\*1000/);
  assert.match(src,/Number\.isInteger\(duration\)/);
  assert.match(src,/duration<1\|\|duration>3650/);
  assert.match(src,/planned_start/);
  assert.match(src,/planned_end/);
});

test('Gantt save submits raw stage intent to PUT then reloads authoritative server plan',()=>{
  assert.match(src,/api\('PUT',`\/projects\/\$\{encodeURIComponent\(state\.projectId\)\}\/gantt-plan`,\{start_date:/);
  assert.match(src,/stages:state\.ganttStages\.map/);
  assert.match(src,/state\.data\.gantt_plan=result\.plan/);
});

test('Gantt PDF is stored-plan only, landscape A4, and paginates at 31 calendar days',()=>{
  assert.match(src,/const PDF_DAYS_PER_PAGE=31/);
  assert.match(src,/Download PDF/);
  assert.match(src,/if\(!plan\?\.stages\?\.length\)return/);
  assert.match(src,/new jsPDF\(\{orientation:'landscape',unit:'mm',format:'a4'\}\)/);
  assert.match(src,/Math\.ceil\(totalDays\/PDF_DAYS_PER_PAGE\)/);
  assert.match(src,/doc\.addPage\(\)/);
  assert.match(src,/doc\.rect\(/);
  assert.match(src,/planned_start/);
  assert.match(src,/planned_end/);
});

test('Phase 3A Gantt UI contains Plan only and does not introduce Actual/Realisasi fields',()=>{
  assert.doesNotMatch(src,/actual_start|actual_end|realisasi_start|realisasi_end/i);
});
