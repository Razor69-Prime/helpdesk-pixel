const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const survey=fs.readFileSync('public/pxl-vnext-2c-survey-flow.js','utf8');
const server=fs.readFileSync('server.js','utf8');

function block(src,start,end){
  const a=src.indexOf(start); assert.notEqual(a,-1,`missing ${start}`);
  const b=src.indexOf(end,a); assert.notEqual(b,-1,`missing ${end}`);
  return src.slice(a,b);
}

test('Survey material picker uses custom fast-search results instead of browser datalist',()=>{
  assert.doesNotMatch(survey,/<datalist id="pxl2c-material-options"/);
  assert.doesNotMatch(survey,/list="pxl2c-material-options"/);
  assert.match(survey,/pxl2c-material-results/);
  assert.match(survey,/function renderMaterialSuggestions\(/);
  assert.match(survey,/autocomplete="off"/);
  assert.match(survey,/SKU:/);
  assert.match(survey,/Stok:/);
});

test('Survey rows are mobile-first and avoid fixed desktop minimum widths',()=>{
  assert.match(survey,/pxl2c-row-compact/);
  assert.match(survey,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) auto/);
  assert.match(survey,/@media\(max-width:640px\)/);
  assert.match(survey,/overflow-x:hidden/);
  assert.doesNotMatch(survey,/grid-template-columns:minmax\(220px,2fr\) 90px 100px minmax\(130px,1fr\) auto/);
});

test('Survey form keeps only technical notes and constraints among narrative fields',()=>{
  assert.match(survey,/id="pxl2c-technical"/);
  assert.match(survey,/id="pxl2c-constraints"/);
  assert.doesNotMatch(survey,/id="pxl2c-conditions"/);
  assert.doesNotMatch(survey,/id="pxl2c-needs"/);
  assert.doesNotMatch(survey,/id="pxl2c-recommendation"/);
  const submit=block(survey,'async function submitSurvey(){','\n  async function cancelWO');
  assert.doesNotMatch(submit,/conditions:/);
  assert.doesNotMatch(submit,/customer_needs:/);
  assert.doesNotMatch(submit,/recommendation:/);
  assert.match(submit,/technical_notes:/);
  assert.match(submit,/constraints:/);
});

test('backend preserves removed legacy Survey narrative fields when saving new form',()=>{
  const route=block(server,"app.post('/api/tickets/:id/survey-report'","\n// PXL-VNEXT-2C — Cancel");
  assert.doesNotMatch(route,/survey_conditions\s*:/);
  assert.doesNotMatch(route,/survey_customer_needs\s*:/);
  assert.doesNotMatch(route,/survey_recommendation\s*:/);
  assert.match(route,/survey_technical_notes\s*:/);
  assert.match(route,/survey_constraints\s*:/);
});

test('Survey mobile script remains cache-busted at PXL-VNEXT-2D1 or newer',()=>{
  const index=fs.readFileSync('public/index.html','utf8');
  assert.match(index,/pxl-vnext-2c-survey-flow\.js\?v=PXL-VNEXT-2D(?:1|2)/);
});
