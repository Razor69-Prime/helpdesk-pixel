const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const migration=path.join(__dirname,'..','PXL-VNEXT-IPO1-MIGRATION.sql');
function sql(){assert.equal(fs.existsSync(migration),true,'IPO1 migration must exist');return fs.readFileSync(migration,'utf8');}

test('IPO1 migration is additive and creates isolated header items history tables',()=>{
  const s=sql();
  assert.match(s,/create table if not exists\s+public\.project_internal_po\b/i);
  assert.match(s,/project_id\s+uuid\s+not null\s+references\s+projects\(id\)/i);
  assert.match(s,/unique\s*\(project_id\)/i);
  assert.match(s,/create table if not exists\s+public\.project_internal_po_items\b/i);
  assert.match(s,/source_type\s+text\s+not null[^;]+check[^;]+\bpr\b[^;]+\bboq\b/is);
  assert.match(s,/deleted_at\s+timestamptz/i);
  assert.match(s,/deleted_by_id\s+text/i);
  assert.match(s,/create table if not exists\s+public\.project_internal_po_history\b/i);
  assert.doesNotMatch(s,/\bdrop\s+table\b/i);
  assert.doesNotMatch(s,/\btruncate\b/i);
});

test('IPO1 migration protects active PR provenance and indexes history',()=>{
  const s=sql();
  assert.match(s,/create unique index if not exists[^;]+project_internal_po_items[^;]+source_pr_id[^;]+source_pr_item_index[^;]+where[^;]+deleted_at\s+is\s+null/is);
  assert.match(s,/create index if not exists[^;]+project_internal_po_history[^;]+project_id[^;]+created_at\s+desc/is);
  assert.match(s,/alter table public\.project_internal_po\s+enable row level security/i);
  assert.match(s,/alter table public\.project_internal_po_items\s+enable row level security/i);
  assert.match(s,/alter table public\.project_internal_po_history\s+enable row level security/i);
  assert.match(s,/create policy[^;]+project_internal_po/is);
});

test('IPO1 save RPC is one transactional PLpgSQL path with validation soft delete and history',()=>{
  const s=sql();
  assert.match(s,/create or replace function public\.pxl_vnext_internal_po_save\s*\(\s*p_project_id uuid,\s*p_general_issue text,\s*p_items jsonb,\s*p_actor_id text,\s*p_actor_name text\s*\)/is);
  assert.match(s,/language plpgsql/i);
  assert.match(s,/if not exists\s*\(select 1 from projects/i);
  assert.match(s,/jsonb_array_elements\(p_items\)/i);
  assert.match(s,/qty_arrived[^;]+qty_po/is);
  assert.match(s,/actual_unit_price/i);
  assert.match(s,/source_type[^;]+(?:pr|boq)/is);
  assert.match(s,/update\s+project_internal_po_items[^;]+deleted_at\s*=\s*now\(\)/is);
  assert.match(s,/insert into\s+project_internal_po_history/i);
  assert.doesNotMatch(s,/create or replace function public\.pxl_vnext_internal_po_(?:insert|update|delete)_item/i,'no partial-write helper outside atomic save');
});


test('saved BOQ snapshots remain editable after source BOQ is later removed',()=>{
  const s=sql();
  assert.match(s,/if v_source_type='boq' and v_item_id is null then[\s\S]*?project_report_items/i);
  assert.doesNotMatch(s,/if v_source_type='boq' then[\s\S]{0,500}project_report_items/i,'existing saved BOQ rows must not require a live BOQ row on every save');
});

test('IPO1 migration never writes to PR Inventory MR BOQ Project Report or finance sources',()=>{
  const s=sql();
  for(const table of ['purchase_requests','inventory','inventory_items','project_material_requests','project_material_request_items','project_report_items','project_report_item_achievements','invoices','crm_invoices','suppliers']){
    const re=new RegExp(`(?:insert\\s+into|update|delete\\s+from)\\s+(?:public\\.)?${table}\\b`,'i');
    assert.doesNotMatch(s,re,`migration must not mutate ${table}`);
  }
});
