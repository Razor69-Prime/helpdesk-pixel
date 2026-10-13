const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'..','PXL-VNEXT-3D-MIGRATION.sql'),'utf8');
test('3D migration creates project photo tables and atomic achievement RPC',()=>{
  assert.match(sql,/create table if not exists\s+(?:public\.)?project_report_item_photos/i);
  assert.match(sql,/project_report_item_id\s+uuid\s+not null\s+references\s+project_report_items\(id\)/i);
  assert.match(sql,/source_type[^\n]+check[^\n]+camera[^\n]+gallery/i);
  assert.match(sql,/time_semantics[^\n]+check[^\n]+documentation[^\n]+upload/i);
  assert.match(sql,/deleted_at\s+timestamptz/i);
  assert.match(sql,/create table if not exists\s+(?:public\.)?project_report_achievement_photos/i);
  assert.match(sql,/unique\s*\(achievement_id\s*,\s*photo_id\)/i);
  assert.match(sql,/create or replace function\s+(?:public\.)?pxl_vnext_3d_create_project_achievement_with_photos/i);
  assert.match(sql,/jsonb_array_elements_text\(p_photo_ids\)/i);
  assert.match(sql,/project_report_item_achievements/i);
  assert.match(sql,/project_report_achievement_photos/i);
});
