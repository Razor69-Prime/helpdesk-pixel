const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','public','pxl-vnext-internal-po.js'),'utf8');

test('manage toolbar exposes PR import and BOQ Material add controls only in editable mode',()=>{
  assert.match(src,/Pilih Purchase Request/);
  assert.match(src,/Tambah Item BOQ/);
  assert.match(src,/editable\?[\s\S]{0,800}Pilih Purchase Request/);
  assert.match(src,/editable\?[\s\S]{0,1000}Tambah Item BOQ/);
});

test('PR chooser searches project-scoped Internal PO support endpoint with bounded debounce',()=>{
  assert.match(src,/\/internal-po\/purchase-requests\?q=\$\{encodeURIComponent/);
  assert.match(src,/setTimeout\([^\n]+(?:180|200|250|300)/);
  assert.match(src,/PR Number|pr_number/);
  assert.match(src,/requester|outlet/);
  assert.match(src,/status/);
});

test('selecting PR appends every not-yet-imported item snapshot and preserves local edits on re-import',()=>{
  assert.match(src,/function importPurchaseRequest\(/);
  assert.match(src,/source_pr_id/);
  assert.match(src,/source_pr_item_index/);
  assert.match(src,/existingKeys/);
  assert.match(src,/if\(existingKeys\.has\(key\)\)\s*return/);
  assert.match(src,/item_name\s*:\s*(?:String\()?item\.(?:desc|item_name)/);
  assert.match(src,/qty_po\s*:/);
  assert.match(src,/qty_arrived\s*:\s*0/);
  assert.match(src,/unit\s*:/);
  assert.match(src,/actual_unit_price/);
  assert.match(src,/source_supplier_id/);
  assert.match(src,/supplier_name/);
  assert.match(src,/manual_state\s*:\s*['"]not_ordered['"]/);
  assert.match(src,/markDirty\(\)/);
});

test('PR source zero or missing price imports blank while imported fields stay editable in normal table',()=>{
  assert.match(src,/price[^\n]+>\s*0[^\n]+null/);
  for(const name of ['item_name','qty_po','actual_unit_price','supplier_name']) assert.ok(src.includes(`field('${name}'`)||src.includes(`field(\"${name}\"`),`${name} must remain editable`);
});

test('BOQ picker searches only Internal PO BOQ endpoint and supports keyboard plus mouse selection',()=>{
  assert.match(src,/\/internal-po\/boq-options\?q=\$\{encodeURIComponent/);
  assert.match(src,/function openBoqPicker\(/);
  assert.match(src,/function selectBoqOption\(/);
  assert.match(src,/onkeydown/);
  assert.match(src,/ArrowDown/);
  assert.match(src,/ArrowUp/);
  assert.match(src,/Enter/);
  assert.match(src,/data-ipo-boq-option/);
  assert.doesNotMatch(src,/\/inventory|master-pricelist|pricelist/i);
});

test('BOQ selection copies stable BOQ identity and may repeat the same BOQ source',()=>{
  assert.match(src,/source_type\s*:\s*['"]boq['"]/);
  assert.match(src,/source_boq_item_id\s*:\s*row\.id/);
  assert.match(src,/item_name\s*:\s*row\.item_name/);
  assert.match(src,/unit\s*:\s*row\.unit/);
  assert.doesNotMatch(src,/existingBoq|duplicateBoq|source_boq_item_id.*has\(/i);
});


test('re-importing a saved PR row after local removal restores its persisted identity before save',()=>{
  assert.match(src,/savedByKey/);
  assert.match(src,/state\.data\?\.items/);
  assert.match(src,/savedByKey\.get\(key\)/);
  assert.match(src,/state\.draft\.items\.push\(\{\.\.\.saved/);
});
