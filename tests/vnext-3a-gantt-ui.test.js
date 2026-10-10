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

test('Gantt PDF is stored-plan only, landscape A4, and fits the full timeline on one page',()=>{
  assert.match(src,/Download PDF/);
  assert.match(src,/if\(!plan\?\.stages\?\.length\)return/);
  assert.match(src,/new jsPDF\(\{orientation:'landscape',unit:'mm',format:'a4'\}\)/);
  assert.match(src,/const cellW=chartW\/Math\.max\(1,totalDays\)/);
  assert.match(src,/const rowH=Math\.min\(/);
  assert.match(src,/Page 1\/1/);
  assert.doesNotMatch(src,/doc\.addPage\(/);
  assert.match(src,/doc\.rect\(/);
  assert.match(src,/planned_start/);
  assert.match(src,/planned_end/);
});

test('Gantt PDF uses deterministic printable stage colors on the single page',()=>{
  assert.match(src,/const GANTT_STAGE_COLORS=\[/);
  const palette=src.match(/const GANTT_STAGE_COLORS=\[([\s\S]*?)\];/)?.[1]||'';
  const entries=(palette.match(/\[[0-9]+,[0-9]+,[0-9]+\]/g)||[]);
  assert.ok(entries.length>=6,'palette must contain at least 6 printable colors');
  assert.match(src,/function ganttStageColor\(index\)/);
  assert.match(src,/GANTT_STAGE_COLORS\[index%GANTT_STAGE_COLORS\.length\]/);
  assert.match(src,/const \[r,g,b\]=ganttStageColor\(i\)/);
  assert.match(src,/doc\.setFillColor\(r,g,b\)[\s\S]{0,220}doc\.rect\(barX,y\+barOffset,barW,barH,'F'\)/);
  assert.match(src,/doc\.setTextColor\(0,0,0\)/);
  assert.match(src,/doc\.setDrawColor\(/);
});

test('Phase 3A Gantt UI contains Plan only and does not introduce Actual/Realisasi fields',()=>{
  assert.doesNotMatch(src,/actual_start|actual_end|realisasi_start|realisasi_end/i);
});
