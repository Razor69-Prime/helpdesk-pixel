const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const migrationPath=path.join(root,'PXL-VNEXT-3B-MIGRATION.sql');
const domainPath=path.join(root,'project-vnext-3b.js');

function migration(){
  assert.equal(fs.existsSync(migrationPath),true,'Phase 3B migration must exist');
  return fs.readFileSync(migrationPath,'utf8');
}
function domain(){
  assert.equal(fs.existsSync(domainPath),true,'Phase 3B domain module must exist');
  delete require.cache[require.resolve(domainPath)];
  return require(domainPath);
}

test('3B migration is additive and creates isolated Project MR persistence',()=>{
  const sql=migration();
  for(const token of [
    'add column if not exists project_number text',
    'project_number_counters','project_material_request_counters',
    'project_material_requests','project_material_request_items',
    'project_material_request_movements','project_material_request_operations',
    'project_material_request_history'
  ]) assert.match(sql,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.match(sql,/create unique index[^;]+project_number/i);
  assert.match(sql,/status[^;]+draft[^;]+submitted[^;]+approved[^;]+rejected[^;]+issued[^;]+final/i);
  assert.match(sql,/source_type[^;]+boq[^;]+inventory_extra/i);
  assert.match(sql,/qty_requested[^;]+>\s*0/i);
  assert.match(sql,/qty_outstanding/i);
  assert.match(sql,/additional_reason/i);
  assert.match(sql,/idempotency_key[^\n]+unique/i);
});

test('3B migration exposes locked concurrency-safe RPCs',()=>{
  const sql=migration();
  for(const fn of [
    'pxl_vnext_3b_create_project_mr',
    'pxl_vnext_3b_replace_project_mr_items',
    'pxl_vnext_3b_transition_project_mr',
    'pxl_vnext_3b_apply_project_mr_movement'
  ]) assert.match(sql,new RegExp(`function\\s+public\\.${fn}`,'i'));
  assert.ok((sql.match(/for\s+update/ig)||[]).length>=4,'counter/state/stock paths must use row locks');
  assert.match(sql,/PROJECT_MR_TAKE/);
  assert.match(sql,/PROJECT_MR_RETURN/);
});

test('normalizeProjectMrItems validates draft/submit and item sources',()=>{
  const {normalizeProjectMrItems}=domain();
  assert.deepEqual(normalizeProjectMrItems([],{requireItems:false}),[]);
  assert.throws(()=>normalizeProjectMrItems([],{requireItems:true}),/item/i);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'boq',project_boq_item_id:'x',qty_requested:0}],{requireItems:true}),/qty|jumlah/i);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'boq',project_boq_item_id:'x',qty_requested:'abc'}],{requireItems:true}),/qty|jumlah/i);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'inventory_extra',inventory_item_id:'x',qty_requested:1}],{requireItems:true}),/alasan|reason/i);
  assert.throws(()=>normalizeProjectMrItems([{source_type:'inventory_extra',additional_reason:'Darurat',qty_requested:1}],{requireItems:true}),/inventory/i);
  const rows=normalizeProjectMrItems([{source_type:'boq',project_boq_item_id:'boq-1',inventory_item_id:'inv-1',item_name:'Kabel',unit:'m',qty_requested:5}],{requireItems:true});
  assert.equal(rows[0].project_boq_item_id,'boq-1');
  assert.equal(rows[0].qty_requested,5);
});

test('calculateProjectMrOutstanding enforces non-negative invariant',()=>{
  const {calculateProjectMrOutstanding}=domain();
  assert.equal(calculateProjectMrOutstanding({qty_taken:10,qty_returned:2,qty_used:3}),5);
  assert.throws(()=>calculateProjectMrOutstanding({qty_taken:1,qty_returned:2,qty_used:0}),/outstanding|negatif/i);
  assert.throws(()=>calculateProjectMrOutstanding({qty_taken:'abc',qty_returned:0,qty_used:0}),/angka|number|valid/i);
});

test('project number backfill does not rewrite project updated_at',()=>{
  const sql=migration();
  const fnStart=sql.search(/function public\.pxl_vnext_3b_ensure_project_number/i);
  const fnEnd=sql.indexOf('end; $$;',fnStart);
  const block=sql.slice(fnStart,fnEnd);
  assert.match(block,/update public\.projects set project_number=v_number where id=p_project_id/i);
  assert.doesNotMatch(block,/update public\.projects set project_number=v_number\s*,\s*updated_at/i);
});
