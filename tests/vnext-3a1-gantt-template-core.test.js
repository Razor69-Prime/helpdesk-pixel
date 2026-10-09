const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=p=>fs.readFileSync(p,'utf8');

test('3A1 migration adds shared Gantt template schema without rewriting project plans',()=>{
  const sql=read('PXL-VNEXT-3A1-MIGRATION.sql');
  assert.match(sql,/create table if not exists public\.project_gantt_templates/i);
  assert.match(sql,/create table if not exists public\.project_gantt_template_stages/i);
  const stageBlock=sql.match(/create table if not exists public\.project_gantt_template_stages\s*\(([^;]+?)\);/is)?.[1]||'';
  assert.match(stageBlock,/template_id\s+uuid/i);
  for(const forbidden of ['start_date','planned_start','planned_end','project_id']) assert.doesNotMatch(stageBlock,new RegExp(`\\b${forbidden}\\b`,'i'));
  assert.match(sql,/pxl_vnext_3a1_create_gantt_template/i);
  assert.match(sql,/length\(trim\(name\)\)\s+between\s+1\s+and\s+120/i);
  assert.match(sql,/duration_days\s+between\s+1\s+and\s+3650/i);
  assert.match(sql,/jsonb_array_length\(p_stages\)/i);
  assert.doesNotMatch(sql,/\b(update|insert\s+into)\s+public\.project_gantt_plans\b/i);
  assert.doesNotMatch(sql,/\b(update|insert\s+into)\s+public\.project_gantt_stages\b/i);
  assert.match(sql,/notify\s+pgrst\s*,\s*'reload schema'/i);
});

test('db-core exposes Gantt template read/create helpers',()=>{
  const src=read('db-core.js');
  for(const fn of ['getProjectGanttTemplates','getProjectGanttTemplate','createProjectGanttTemplate']){
    assert.match(src,new RegExp(`async function ${fn}\\(`));
    assert.match(src,new RegExp(`\\b${fn}\\b[^}]*module.exports|module.exports[\\s\\S]*\\b${fn}\\b`));
  }
  assert.match(src,/pxl_vnext_3a1_create_gantt_template/);
  assert.match(src,/project_gantt_template_stages\?template_id=eq\./);
});
