const test=require('node:test');
const assert=require('node:assert/strict');
const {
  MANUAL_STATES,
  normalizeInternalPoItem,
  deriveInternalPoItemStatus,
  deriveInternalPoOverallStatus,
  calculateInternalPoTotals,
  mapPurchaseRequestItem,
  normalizeInternalPoDraft
}=require('../project-internal-po');

function item(overrides={}){
  return {source_type:'boq',source_boq_item_id:'11111111-1111-1111-1111-111111111111',item_name:'Camera',qty_po:10,qty_arrived:0,unit:'pcs',actual_unit_price:null,supplier_name:null,manual_state:'not_ordered',issue:null,...overrides};
}

test('item status precedence is cancelled arrived partial hold ordered not ordered',()=>{
  assert.equal(deriveInternalPoItemStatus(item({manual_state:'cancelled',qty_arrived:10})),'Cancelled');
  assert.equal(deriveInternalPoItemStatus(item({manual_state:'hold',qty_arrived:10})),'Arrived');
  assert.equal(deriveInternalPoItemStatus(item({manual_state:'ordered',qty_arrived:4})),'Partial Arrived');
  assert.equal(deriveInternalPoItemStatus(item({manual_state:'hold',qty_arrived:0})),'Hold');
  assert.equal(deriveInternalPoItemStatus(item({manual_state:'ordered',qty_arrived:0})),'Ordered');
  assert.equal(deriveInternalPoItemStatus(item({manual_state:'not_ordered',qty_arrived:0})),'Belum Dipesan');
});

test('overall status ignores cancelled rows and derives project monitoring state',()=>{
  assert.equal(deriveInternalPoOverallStatus([]),'Belum Ada Item');
  assert.equal(deriveInternalPoOverallStatus([item({manual_state:'cancelled'})]),'Cancelled');
  assert.equal(deriveInternalPoOverallStatus([item({qty_arrived:10}),item({manual_state:'cancelled'})]),'Completed');
  assert.equal(deriveInternalPoOverallStatus([item({qty_arrived:10}),item({manual_state:'ordered'})]),'Partial');
  assert.equal(deriveInternalPoOverallStatus([item({qty_arrived:3}),item()]),'Partial');
  assert.equal(deriveInternalPoOverallStatus([item({manual_state:'ordered'}),item({manual_state:'hold'})]),'In Progress');
  assert.equal(deriveInternalPoOverallStatus([item(),item()]),'Belum Dipesan');
});

test('normalization validates quantities, price, item name and manual state',()=>{
  assert.equal(normalizeInternalPoItem(item()).qty_po,10);
  assert.throws(()=>normalizeInternalPoItem(item({qty_po:0})),/Qty PO/i);
  assert.throws(()=>normalizeInternalPoItem(item({qty_arrived:-1})),/Qty Arrived/i);
  assert.throws(()=>normalizeInternalPoItem(item({qty_arrived:11})),/Qty Arrived/i);
  assert.throws(()=>normalizeInternalPoItem(item({actual_unit_price:-1})),/Harga/i);
  assert.throws(()=>normalizeInternalPoItem(item({item_name:'  '})),/Nama barang/i);
  assert.throws(()=>normalizeInternalPoItem(item({manual_state:'received'})),/status/i);
  assert.deepEqual(MANUAL_STATES,['not_ordered','ordered','hold','cancelled']);
});

test('blank price stays unknown while explicit zero is valid and excluded/included correctly',()=>{
  const rows=[item({qty_po:2,actual_unit_price:''}),item({qty_po:3,actual_unit_price:0}),item({qty_po:4,actual_unit_price:25000})].map(normalizeInternalPoItem);
  assert.equal(rows[0].actual_unit_price,null);
  assert.equal(rows[1].actual_unit_price,0);
  const totals=calculateInternalPoTotals(rows);
  assert.deepEqual(totals.line_totals,[null,0,100000]);
  assert.equal(totals.grand_total,100000);
  assert.equal(totals.priced_item_count,2);
});

test('purchase request mapping copies snapshot fields and zero source price becomes blank',()=>{
  const pr={id:'22222222-2222-2222-2222-222222222222',pr_number:'PR-009'};
  const mapped=mapPurchaseRequestItem({desc:' NVR 8CH ',qty:'2',unit:'unit',price:'1500000',supplier_id:'33333333-3333-3333-3333-333333333333',supplier_name:'PT Sumber'},4,pr);
  assert.equal(mapped.source_type,'pr');
  assert.equal(mapped.source_pr_id,pr.id);
  assert.equal(mapped.source_pr_number,'PR-009');
  assert.equal(mapped.source_pr_item_index,4);
  assert.equal(mapped.item_name,'NVR 8CH');
  assert.equal(mapped.qty_po,2);
  assert.equal(mapped.qty_arrived,0);
  assert.equal(mapped.unit,'unit');
  assert.equal(mapped.actual_unit_price,1500000);
  assert.equal(mapped.source_supplier_id,'33333333-3333-3333-3333-333333333333');
  assert.equal(mapped.supplier_name,'PT Sumber');
  assert.equal(mapped.manual_state,'not_ordered');
  assert.equal(mapped.issue,null);
  assert.equal(mapPurchaseRequestItem({desc:'HDD',qty:1,price:0},0,pr).actual_unit_price,null);
});

test('draft normalization rejects duplicate PR provenance without overwriting a row',()=>{
  const pr={id:'22222222-2222-2222-2222-222222222222',pr_number:'PR-009'};
  const a=mapPurchaseRequestItem({desc:'Camera',qty:1},0,pr);
  const b={...a,item_name:'Edited Camera'};
  assert.throws(()=>normalizeInternalPoDraft({general_issue:'',items:[a,b]}),/duplikat.*Purchase Request/i);
});
