const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const migrationPath=path.join(__dirname,'..','PXL-VNEXT-3A2-MIGRATION.sql');
const migration=()=>fs.existsSync(migrationPath)?fs.readFileSync(migrationPath,'utf8'):'';

test('3A2 migration creates additive Related WO relation with defensive uniqueness',()=>{
  const sql=migration();
  assert.match(sql,/create table if not exists public\.project_related_work_orders/i);
  assert.match(sql,/id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(sql,/project_id uuid not null references public\.projects\(id\)/i);
  assert.match(sql,/ticket_id uuid not null references public\.tickets\(id\)/i);
  assert.match(sql,/created_by text/i);
  assert.match(sql,/created_at timestamptz not null default now\(\)/i);
  assert.match(sql,/unique\s*\(ticket_id\)/i);
  assert.match(sql,/unique\s*\(project_id,\s*ticket_id\)/i);
});

test('3A2 migration never guesses or backfills Related WOs from project names',()=>{
  const sql=migration();
  assert.doesNotMatch(sql,/insert\s+into\s+public\.project_related_work_orders[\s\S]{0,500}select/i);
  assert.doesNotMatch(sql,/project_name\s*=|ilike[\s\S]{0,100}project/i);
});

test('cross-table guard rejects Primary/Related duplication and is attached to both tables',()=>{
  const sql=migration();
  assert.match(sql,/create or replace function public\.pxl_vnext_3a2_guard_project_work_order_link\(\)/i);
  assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\(NEW\.ticket_id::text,\s*0\)\)/i);
  assert.match(sql,/TG_TABLE_NAME\s*=\s*'project_primary_work_orders'/i);
  assert.match(sql,/from public\.project_related_work_orders/i);
  assert.match(sql,/from public\.project_primary_work_orders/i);
  assert.match(sql,/before insert or update[\s\S]{0,180}on public\.project_primary_work_orders/i);
  assert.match(sql,/before insert or update[\s\S]{0,180}on public\.project_related_work_orders/i);
  assert.match(sql,/Work Order sudah terhubung ke Project lain|Work Order sudah terhubung ke project/i);
});

test('3A2 migration enables RLS and reloads PostgREST schema',()=>{
  const sql=migration();
  assert.match(sql,/alter table public\.project_related_work_orders enable row level security/i);
  assert.match(sql,/create policy "Allow all for authenticated"\s+on public\.project_related_work_orders/i);
  assert.match(sql,/notify pgrst, 'reload schema'/i);
});
