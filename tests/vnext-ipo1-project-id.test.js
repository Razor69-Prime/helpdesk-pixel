const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
function slice(start,end){const a=src.indexOf(start);assert.ok(a>=0,`${start} missing`);const b=src.indexOf(end,a+1);assert.ok(b>a,`${end} missing`);return src.slice(a,b)}

test('Project search matches project name or human Project ID and placeholder advertises Project ID',()=>{
  const f=slice('function filterProjects(){','function projectMobileEsc');
  assert.match(f,/p\.nama_project/);
  assert.match(f,/p\.project_number/);
  assert.match(f,/includes\(search\)/);
  assert.match(src,/id="proj-search"[^>]+placeholder="[^"]*Project ID[^"]*"/);
});

test('mobile Project Tracker renders human Project ID without raw UUID fallback',()=>{
  const f=slice('function renderProjectMobileCards(filtered){','function renderProjectList(){');
  assert.match(f,/p\.project_number/);
  assert.match(f,/Project ID/);
  assert.doesNotMatch(f,/Project ID[^\n]{0,160}p\.id/);
  assert.match(f,/proj-mobile-progress/);
  assert.match(f,/>Material<\/span>/);
  assert.match(f,/>Jasa<\/span>/);
  assert.match(f,/pxlProjectVnext3A.*\.open/);
});

test('desktop Project Tracker renders Project ID next to name and keeps actions/progress',()=>{
  const f=slice('function renderProjectList(){','function showProjectHistory');
  assert.match(f,/p\.project_number/);
  assert.match(f,/Project ID/);
  assert.doesNotMatch(f,/Project ID[^\n]{0,160}p\.id/);
  assert.match(f,/Material \$\{m\.toFixed\(1\)\}%/);
  assert.match(f,/Jasa \$\{j\.toFixed\(1\)\}%/);
  assert.match(f,/pxlProjectVnext3A.*\.open/);
  assert.match(f,/editProject/);
  assert.match(f,/deleteProject/);
});

test('Project Tracker numbering source remains existing project_number and no regeneration logic is added',()=>{
  assert.doesNotMatch(src,/project_number\s*=\s*['"`]PRJ|generateProjectNumber|nextProjectNumber/i);
});
