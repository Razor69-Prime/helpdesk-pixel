const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'PXL-VNEXT-3C-MIGRATION.sql'),'utf8');

test('3C migration creates append-only project material override audit storage',()=>{
  assert.match(sql,/create table if not exists public\.project_material_usage_overrides\s*\(/i);
  assert.match(sql,/id\s+uuid\s+primary key\s+default\s+gen_random_uuid\(\)/i);
  assert.match(sql,/project_id\s+uuid\s+not null/i);
  assert.match(sql,/project_boq_item_id\s+uuid\s+not null/i);
  assert.match(sql,/primary_work_order_ticket_id\s+uuid/i);
  assert.match(sql,/item_name_snapshot\s+text\s+not null/i);
  assert.match(sql,/qty\s+numeric\(14,2\)\s+not null\s+check\s*\(qty>0\)/i);
  assert.match(sql,/reason\s+text\s+not null/i);
  assert.match(sql,/length\s*\(trim\s*\(reason\)\)\s*>\s*0/i);
  for(const column of ['created_by_user_id','created_by','created_at','reversed_at','reversed_by_user_id','reversed_by','reversal_reason']) assert.match(sql,new RegExp(`\\b${column}\\b`,'i'));
});

test('3C override snapshots do not cascade to project, BOQ, or ticket records',()=>{
  const start=sql.search(/create table if not exists public\.project_material_usage_overrides/i);
  assert.notEqual(start,-1);
  const end=sql.indexOf(');',start);
  const table=sql.slice(start,end+2);
  assert.doesNotMatch(table,/references\s+public\.(projects|project_report_items|tickets)/i);
  assert.doesNotMatch(table,/on delete cascade/i);
});

test('3C migration indexes override lookup and enables authenticated RLS without destructive SQL',()=>{
  assert.match(sql,/create index if not exists\s+idx_project_material_usage_overrides_project/i);
  assert.match(sql,/create index if not exists\s+idx_project_material_usage_overrides_boq/i);
  assert.match(sql,/alter table public\.project_material_usage_overrides enable row level security/i);
  assert.match(sql,/create policy\s+"?Allow all for authenticated"?\s+on public\.project_material_usage_overrides/i);
  assert.doesNotMatch(sql,/\bdrop\b|\btruncate\b|material_request_forms/i);
});
