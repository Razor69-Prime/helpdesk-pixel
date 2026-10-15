const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../project-internal-po');
const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-internal-po.js'),'utf8');
const migrationPath=path.join(__dirname,'..','PXL-VNEXT-IPO1E-MIGRATION.sql');

function item(overrides={}){
  return {
    source_type:'boq',
    source_boq_item_id:'11111111-1111-1111-1111-111111111111',
    item_name:'Camera',qty_po:2,qty_arrived:0,unit:'pcs',
    actual_unit_price:100000,is_ppn:false,supplier_name:null,
    manual_state:'not_ordered',issue:null,...overrides
  };
}

test('PPN is opt-in per Internal PO item and defaults false for existing rows',()=>{
  const normal=core.normalizeInternalPoItem(item({is_ppn:undefined}));
  const taxed=core.normalizeInternalPoItem(item({is_ppn:true}));
  assert.equal(normal.is_ppn,false);
  assert.equal(taxed.is_ppn,true);
});

test('Internal PO totals add 11 percent PPN only when checkbox is enabled',()=>{
  const totals=core.calculateInternalPoTotals([
    item({qty_po:2,actual_unit_price:100000,is_ppn:false}),
    item({qty_po:3,actual_unit_price:100000,is_ppn:true}),
    item({qty_po:1,actual_unit_price:null,is_ppn:true}),
  ]);
  assert.deepEqual(totals.final_unit_prices,[100000,111000,null]);
  assert.deepEqual(totals.line_totals,[200000,333000,null]);
  assert.equal(totals.grand_total,533000);
});

test('PR imports start as non PPN so existing purchase request prices do not change',()=>{
  const mapped=core.mapPurchaseRequestItem({desc:'NVR',qty:1,price:1500000},0,{id:'22222222-2222-2222-2222-222222222222',pr_number:'PR-001'});
  assert.equal(mapped.is_ppn,false);
});

test('PPN migration is additive and persists checkbox in atomic save RPC',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'IPO1E migration must exist');
  const sql=fs.readFileSync(migrationPath,'utf8');
  assert.match(sql,/alter table\s+public\.project_internal_po_items\s+add column if not exists\s+is_ppn\s+boolean\s+not null\s+default\s+false/i);
  assert.match(sql,/v_is_ppn\s+boolean/i);
  assert.match(sql,/is_ppn=v_is_ppn/i);
  assert.match(sql,/actual_unit_price[^;]+is_ppn/is);
  assert.doesNotMatch(sql,/\bdrop\s+table\b|\btruncate\b/i);
});

test('Internal PO table exposes per-row PPN checkbox and computed final purchase price',()=>{
  assert.match(ui,/Harga Beli Non-PPN/);
  assert.match(ui,/>PPN 11%<|PPN 11%/);
  assert.match(ui,/Harga Final/);
  assert.match(ui,/data-ipo-field="is_ppn"/);
  assert.match(ui,/type="checkbox"/);
  assert.match(ui,/field==='is_ppn'\?el\.checked/);
  assert.match(ui,/1\.11|PPN_RATE/);
});
