const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');

test('Project Tracker starts projects and summary requests together and renders projects before waiting for summary',()=>{
  const start=html.indexOf('async function loadProjects()');
  const end=html.indexOf('function populateProjectPicFilter',start);
  const block=html.slice(start,end);
  assert.match(block,/projectsRequest\s*=\s*api\('GET','\/projects'\)/);
  assert.match(block,/summariesRequest\s*=\s*api\('GET','\/project-report-summaries'\)/);
  const awaitProjects=block.indexOf('await projectsRequest');
  const firstRender=block.indexOf('renderProjectList()');
  const awaitSummaries=block.indexOf('await summariesRequest');
  assert.ok(awaitProjects>=0&&firstRender>awaitProjects&&awaitSummaries>firstRender,'projects must render before summary finishes');
});

test('opening Project Tracker does not issue a duplicate refreshSummaries request',()=>{
  const line=html.match(/if\(tab==='projects'\)[^\n]+/)?.[0]||'';
  assert.doesNotMatch(line,/refreshSummaries/);
  assert.match(line,/loadProjects\(\)/);
});

test('mobile Project Tracker skips building hidden desktop table rows',()=>{
  const start=html.indexOf('function renderProjectList()');
  const end=html.indexOf('async function saveProject',start);
  const block=html.slice(start,end);
  assert.match(block,/matchMedia.*max-width:\s*760px/);
  assert.match(block,/tbody\.innerHTML='';\s*return/);
});
