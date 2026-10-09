const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('public/index.html','utf8');

test('Project Tracker has separate mobile card container and responsive visibility',()=>{
  assert.match(src,/id="proj-mobile-list"/);
  assert.match(src,/\.proj-mobile-list\{display:none/);
  assert.match(src,/@media\(max-width:700px\)[\s\S]{0,1200}#tab-projects \.proj-table-wrap\{display:none/);
  assert.match(src,/@media\(max-width:700px\)[\s\S]{0,1500}\.proj-mobile-list\{display:grid/);
});

test('mobile project cards contain required project summary and Detail action',()=>{
  assert.match(src,/function renderProjectMobileCards\(filtered\)/);
  for(const token of ['Material','Jasa','PIC','Target','Issue','Action Plan','Detail']) assert.match(src,new RegExp(token));
  assert.match(src,/window\.pxlProjectReportSummaries/);
  assert.match(src,/window\.pxlProjectVnext3A.*\.open/);
});

test('mobile project text is clamped and avoids horizontal overflow',()=>{
  assert.match(src,/\.proj-mobile-clamp\{[^}]*-webkit-line-clamp:/);
  assert.match(src,/\.proj-mobile-card\{[^}]*min-width:0/);
  assert.match(src,/\.proj-mobile-list\{display:none;[^}]*min-width:0/);
});

test('renderProjectList renders mobile empty state from same filtered source',()=>{
  assert.match(src,/renderProjectMobileCards\(filtered\)/);
  assert.match(src,/proj-mobile-empty/);
  assert.match(src,/Belum ada project/);
  assert.match(src,/tbody\.innerHTML='<tr><td colspan="12"/);
});
