const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('public/index.html','utf8');

test('Project Tracker supports Done status in form, filter, and badges',()=>{
  assert.ok((src.match(/<option value="Done">Done<\/option>/g)||[]).length>=2,'Done must exist in filter and project form');
  assert.match(src,/\.proj-status-badge\.done\{/);
  assert.match(src,/['"]Done['"]\s*:\s*['"]done['"]/);
});
