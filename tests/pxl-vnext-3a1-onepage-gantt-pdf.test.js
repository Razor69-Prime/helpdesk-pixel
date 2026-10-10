const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-3a-project-detail.js'),'utf8');

test('Gantt PDF renders the entire schedule on one landscape A4 page',()=>{
  const start=src.indexOf('function downloadGanttPdf()');
  const end=src.indexOf('\n  function renderWorkOrder()',start);
  assert.ok(start>=0&&end>start,'downloadGanttPdf must exist');
  const body=src.slice(start,end);
  assert.match(body,/orientation:'landscape'/);
  assert.match(body,/format:'a4'/);
  assert.doesNotMatch(body,/doc\.addPage\(/,'Gantt PDF must not paginate');
  assert.doesNotMatch(body,/datePages|stagePages|totalPages/,'one-page export must not use page loops');
  assert.match(body,/const cellW=chartW\/Math\.max\(1,totalDays\)/);
  assert.match(body,/const rowH=Math\.min\(/,'stage rows must scale to available page height');
  assert.match(body,/Page 1\/1/);
});

test('one-page Gantt keeps deterministic colored stage bars',()=>{
  const start=src.indexOf('function downloadGanttPdf()');
  const end=src.indexOf('\n  function renderWorkOrder()',start);
  const body=src.slice(start,end);
  assert.match(body,/ganttStageColor\(i\)/);
  assert.match(body,/doc\.setFillColor\(r,g,b\)/);
  assert.match(body,/doc\.rect\(barX,y\+barOffset,barW,barH,'F'\)/);
});
