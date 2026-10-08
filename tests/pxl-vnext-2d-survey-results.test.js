const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const index=fs.readFileSync('public/index.html','utf8');

function block(start,end){
  const a=index.indexOf(start); assert.notEqual(a,-1,`missing ${start}`);
  const b=index.indexOf(end,a); assert.notEqual(b,-1,`missing ${end}`);
  return index.slice(a,b);
}

test('Hasil Survey is a dedicated Operasional Teknisi menu sharing Work Order access',()=>{
  assert.match(index,/\{id:'survey_results',\s*label:'[^']*Hasil Survey'/);
  assert.match(index,/Operasional Teknisi',\s*ids:\['report','tickets','survey_results','service_center','materials'\]/);
  assert.match(index,/effective\.includes\('tickets'\).*survey_results/s);
  assert.doesNotMatch(index,/SURVEY_RESULTS_PERMISSIONS|survey_result_create_so/);
});

test('Hasil Survey tab only renders submitted manual Survey WO results',()=>{
  assert.match(index,/id="tab-survey_results"/);
  assert.match(index,/id="survey-results-list"/);
  const render=block('function renderSurveyResults(){','\n}\n\nfunction ');
  assert.match(render,/work_order_type\|\|''\)==='Survey'/);
  assert.match(render,/source_type\|\|'manual'/);
  assert.match(render,/\['ready_for_so','so_created'\]\.includes/);
  assert.match(render,/survey_completed_at/);
  assert.match(render,/survey_materials/);
  assert.match(render,/survey_services/);
});

test('Hasil Survey actions reuse existing read-only survey and Survey to SO flow',()=>{
  const render=block('function renderSurveyResults(){','\n}\n\nfunction ');
  assert.match(render,/openSurveyReportModal\([^,]+,true\)/);
  assert.match(render,/canCreateSalesOrderFromSurvey/);
  assert.match(render,/openSalesOrderFromSurvey/);
  assert.match(render,/openExistingSalesOrderFromSurvey/);
  assert.match(render,/Buat Sales Order/);
  assert.match(render,/Buka Sales Order/);
});

test('existing SO action keeps the same existing Survey to SO permission gate',()=>{
  const render=block('function renderSurveyResults(){','\n}\n\nfunction ');
  assert.match(render,/done&&canCreate/);
  assert.match(render,/SO terkait tersedia/);
});

test('Survey to SO action waits until WO Survey is Done',()=>{
  const render=block('function renderSurveyResults(){','\n}\n\nfunction ');
  assert.match(render,/const woDone=String\(t\.status\|\|''\)\.toLowerCase\(\)==='done'/);
  assert.match(render,/woDone&&canCreate/);
  assert.match(render,/Menunggu TTD \/ WO Selesai/);
});

test('opening Hasil Survey refreshes ticket data and rerenders result center',()=>{
  const switchBlock=block('function switchTab(tab,btn){','\n}\n\n/* ══ API');
  assert.match(switchBlock,/tab==='survey_results'/);
  assert.match(switchBlock,/renderSurveyResults\(\)/);
  assert.match(switchBlock,/loadTickets\(true\)/);
  const loadBlock=block('async function loadTickets(force=false){','\n}\n\nasync function loadSalesPics(){');
  assert.match(loadBlock,/renderSurveyResults/);
});

test('saving Survey result does not open a second TTD flow',()=>{
  const survey=fs.readFileSync('public/pxl-vnext-2c-survey-flow.js','utf8');
  const a=survey.indexOf('async function submitSurvey(){');
  const b=survey.indexOf('\n  async function cancelWO',a);
  assert.notEqual(a,-1,'submitSurvey missing');
  assert.notEqual(b,-1,'submitSurvey end missing');
  const submit=survey.slice(a,b);
  assert.doesNotMatch(submit,/openTTDSelesaiModal/);
  assert.match(submit,/Simpan Hasil Survey/);
  assert.doesNotMatch(submit,/Lanjut TTD/);
});

test('Detail WO provides Survey result access only for manual Survey WO',()=>{
  const detail=fs.readFileSync('public/pxl-urg-0038-ticket-detail-modal.js','utf8');
  assert.match(detail,/function isManualSurvey\(t\)/);
  assert.match(detail,/work_order_type\|\|''\).*Survey/);
  assert.match(detail,/id="pxl-0038-survey"/);
  assert.match(detail,/openSurveyReportModal/);
  assert.match(detail,/Isi Hasil Survey/);
  assert.match(detail,/Edit Hasil Survey|Lihat Hasil Survey/);
});

test('Detail WO loader is cache-busted for PXL-VNEXT-2D',()=>{
  const wrapper=fs.readFileSync('pxl-stg-0004f.js','utf8');
  assert.match(wrapper,/pxl-urg-0032b-remarks-layout\.js\?v=PXL-VNEXT-2D/);
});
