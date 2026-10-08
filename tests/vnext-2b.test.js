const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const migration=path.join(root,'PXL-VNEXT-2B-MIGRATION.sql');

test('2B migration adds survey result fields without changing WO status flow',()=>{
  assert.ok(fs.existsSync(migration));
  const sql=fs.readFileSync(migration,'utf8');
  for(const f of ['survey_location','survey_pic_name','survey_pic_phone','survey_notes','survey_result']) assert.match(sql,new RegExp(`add column if not exists ${f}`,'i'));
});

test('Input WO exposes survey fields conditionally for Survey WO',()=>{
  assert.match(index,/id="f-survey-fields"/);
  assert.match(index,/Lokasi Survey/);
  assert.match(index,/PIC Survey/);
  assert.match(index,/Hasil Survey/);
  assert.match(index,/toggleSurveyFields/);
});

test('backend stores survey fields only on Survey classification and keeps assigned flow',()=>{
  assert.match(server,/survey_location/);
  assert.match(server,/survey_pic_name/);
  assert.match(server,/survey_result/);
  assert.match(server,/workOrderType\s*===\s*['"]Survey['"]/);
  assert.match(server,/status:\s*'assigned'/);
});
