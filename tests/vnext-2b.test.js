const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const migration=path.join(root,'PXL-VNEXT-2B-MIGRATION.sql');

test('2B migration retains legacy survey columns for backward compatibility',()=>{
  assert.ok(fs.existsSync(migration));
  const sql=fs.readFileSync(migration,'utf8');
  for(const f of ['survey_location','survey_pic_name','survey_pic_phone','survey_notes','survey_result']) assert.match(sql,new RegExp(`add column if not exists ${f}`,'i'));
});

test('2C supersedes inline Survey input: Input WO no longer asks technician survey result',()=>{
  assert.doesNotMatch(index,/id="f-survey-fields"/);
  assert.match(index,/Form hasil Survey diisi teknisi saat reporting/);
  assert.match(index,/pxl-vnext-2c-survey-flow\.js/);
});

test('backend keeps legacy survey storage compatibility and assigned flow',()=>{
  assert.match(server,/survey_location/);
  assert.match(server,/survey_pic_name/);
  assert.match(server,/survey_result/);
  assert.match(server,/workOrderType\s*===\s*['"]Survey['"]/);
  assert.match(server,/status:\s*'assigned'/);
});
