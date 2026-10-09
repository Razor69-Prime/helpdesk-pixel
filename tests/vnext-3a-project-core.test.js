const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const migrationPath=path.join(root,'PXL-VNEXT-3A-MIGRATION.sql');
const modulePath=path.join(root,'project-vnext-3a.js');
const dbCore=fs.readFileSync(path.join(root,'db-core.js'),'utf8');

function loadCore(){
  assert.equal(fs.existsSync(modulePath),true,'Phase 3A date engine must exist');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('3A migration creates additive primary WO and Gantt persistence with atomic replace RPC',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'Phase 3A migration must exist');
  const sql=fs.readFileSync(migrationPath,'utf8');
  assert.match(sql,/create table if not exists\s+(?:public\.)?project_primary_work_orders/i);
  assert.match(sql,/create table if not exists\s+(?:public\.)?project_gantt_plans/i);
  assert.match(sql,/create table if not exists\s+(?:public\.)?project_gantt_stages/i);
  assert.match(sql,/ticket_id\s+uuid\s+(?:unique\s+)?references\s+(?:public\.)?tickets\s*\(id\)/i);
  assert.match(sql,/unique\s*\(\s*ticket_id\s*\)/i);
  assert.match(sql,/duration_days[\s\S]{0,180}check\s*\(\s*duration_days\s+between\s+1\s+and\s+3650\s*\)/i);
  for(const col of ['created_by','created_at','updated_by','updated_at']) assert.match(sql,new RegExp(`\\b${col}\\b`));
  assert.match(sql,/create or replace function\s+(?:public\.)?pxl_vnext_3a_replace_project_gantt_plan/i);
  assert.doesNotMatch(sql,/insert\s+into\s+project_primary_work_orders\s*\([^)]*\)\s*select/i,'migration must not guess/backfill Primary WO');
  assert.doesNotMatch(sql,/grant\s+execute[\s\S]{0,180}to\s+anon\s*,\s*authenticated\s*,\s*service_role/i,'Full VPS migration must not depend on Supabase-only roles');
  assert.match(sql,/notify\s+pgrst\s*,\s*['"]reload schema['"]/i,'migration must reload PostgREST schema cache after adding new tables/RPC');
});

test('default Gantt stages are exactly the approved nine stages',()=>{
  const {DEFAULT_PROJECT_GANTT_STAGES}=loadCore();
  assert.deepEqual(DEFAULT_PROJECT_GANTT_STAGES,[
    'Preparation','Order Barang','Amprah PLN','Tanam Tiang','Tarik Kabel FO','Instalasi Perangkat','Konfigurasi','Testing / Commissioning','Serah Terima'
  ]);
});

test('sequential Gantt uses calendar days across month boundary without timezone drift',()=>{
  const {buildSequentialGanttPlan}=loadCore();
  const rows=buildSequentialGanttPlan('2026-10-31',[
    {name:'Tahap 1',duration_days:3,notes:'a'},
    {name:'Tahap 2',duration_days:2,notes:'b'}
  ]);
  assert.deepEqual(rows,[
    {name:'Tahap 1',duration_days:3,notes:'a',sort_order:0,planned_start:'2026-10-31',planned_end:'2026-11-02'},
    {name:'Tahap 2',duration_days:2,notes:'b',sort_order:1,planned_start:'2026-11-03',planned_end:'2026-11-04'}
  ]);
});

test('sequential Gantt rejects invalid date, names, durations, and more than 100 stages',()=>{
  const {buildSequentialGanttPlan}=loadCore();
  const badDates=['','2026-02-30','31-10-2026','2026-13-01'];
  for(const d of badDates) assert.throws(()=>buildSequentialGanttPlan(d,[{name:'A',duration_days:1}]),/date|tanggal/i);
  for(const duration of [0,-1,1.5,3651,NaN]) assert.throws(()=>buildSequentialGanttPlan('2026-10-01',[{name:'A',duration_days:duration}]),/duration|durasi/i);
  assert.throws(()=>buildSequentialGanttPlan('2026-10-01',[{name:'',duration_days:1}]),/name|nama/i);
  assert.throws(()=>buildSequentialGanttPlan('2026-10-01',Array.from({length:101},(_,i)=>({name:`S${i}`,duration_days:1}))),/100/);
});

test('db-core exposes Phase 3A persistence and compact WO lookup interfaces',()=>{
  for(const fn of [
    'getProjectPrimaryWorkOrder','upsertProjectPrimaryWorkOrder','getProjectGanttPlan','replaceProjectGanttPlan','getTicketById','searchTicketsCompact'
  ]) assert.match(dbCore,new RegExp(`async function ${fn}\\b`),`${fn} must be implemented`);
  assert.match(dbCore,/pxl_vnext_3a_replace_project_gantt_plan/);
  assert.match(dbCore,/const select=['"]id,wo_number,work_order_type,status,customer_name,project_name,technician,technicians,worked_at,created_at['"]/);
});
