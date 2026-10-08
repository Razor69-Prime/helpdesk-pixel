const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const survey=fs.readFileSync('public/pxl-vnext-2c-survey-flow.js','utf8');
const index=fs.readFileSync('public/index.html','utf8');

test('Survey catalog carries source_key for PROBUS detection',()=>{
  assert.match(survey,/source_key:String\(x\.source_key\|\|''\)/);
  assert.match(survey,/function isProbusItem\(item\)/);
  assert.match(survey,/MANUAL:PROBUS:/);
});

test('Survey fast-search suggestion displays PROBUS badge only for PROBUS items',()=>{
  assert.match(survey,/pxl2c-probus-badge/);
  assert.match(survey,/isProbusItem\(item\).*PROBUS/s);
  const a=survey.indexOf('function renderMaterialSuggestions');
  const b=survey.indexOf('\n  function addMaterialRow',a);
  assert.notEqual(a,-1);assert.notEqual(b,-1);
  const block=survey.slice(a,b);
  assert.match(block,/probusBadge\(item\)/);
});

test('selected Survey material keeps PROBUS badge visible',()=>{
  const a=survey.indexOf('function selectMaterial');
  const b=survey.indexOf('\n  function renderMaterialSuggestions',a);
  assert.notEqual(a,-1);assert.notEqual(b,-1);
  const block=survey.slice(a,b);
  assert.match(block,/selected\.innerHTML/);
  assert.match(block,/probusBadge\(item\)/);
});

test('Survey script cache version is PXL-VNEXT-2D2',()=>{
  assert.match(index,/pxl-vnext-2c-survey-flow\.js\?v=PXL-VNEXT-2D2/);
});
