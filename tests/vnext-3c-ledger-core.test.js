const test=require('node:test');
const assert=require('node:assert/strict');
const {
  normalizeProjectMaterialOverrideInput,
  projectMrReleaseQty,
  summarizeProjectMaterialLedger
}=require('../project-vnext-3c');

test('projectMrReleaseQty ignores non-approved MR states',()=>{
  const item={qty_requested:10,qty_returned:2,qty_taken:9,qty_used:7};
  for(const status of ['draft','submitted','rejected']) assert.equal(projectMrReleaseQty(item,status),0,status);
});

test('projectMrReleaseQty uses requested qty for approved and net requested minus returned for issued/final',()=>{
  const item={qty_requested:10,qty_returned:3,qty_taken:9,qty_used:8};
  assert.equal(projectMrReleaseQty(item,'approved'),10);
  assert.equal(projectMrReleaseQty(item,'issued'),7);
  assert.equal(projectMrReleaseQty(item,'final'),7);
  assert.equal(projectMrReleaseQty({...item,qty_returned:99},'final'),0);
});

test('summarizeProjectMaterialLedger sums exact BOQ id, active overrides, and clamps available qty',()=>{
  const materialRequests=[
    {status:'approved',items:[
      {project_boq_item_id:'boq-1',qty_requested:4,qty_returned:0},
      {project_boq_item_id:'boq-2',qty_requested:50,qty_returned:0}
    ]},
    {status:'issued',items:[{project_boq_item_id:'boq-1',qty_requested:6,qty_returned:1,qty_taken:6,qty_used:6}]},
    {status:'draft',items:[{project_boq_item_id:'boq-1',qty_requested:100,qty_returned:0}]}
  ];
  const overrides=[
    {project_boq_item_id:'boq-1',qty:2,reversed_at:null},
    {project_boq_item_id:'boq-1',qty:3,reversed_at:'2026-10-11T00:00:00Z'},
    {project_boq_item_id:'boq-2',qty:100,reversed_at:null}
  ];
  assert.deepEqual(summarizeProjectMaterialLedger({boqItemId:'boq-1',materialRequests,overrides,totalDone:8}),{
    mr_approved_qty:9,
    override_qty:2,
    usage_limit:11,
    available_for_use:3
  });
  assert.equal(summarizeProjectMaterialLedger({boqItemId:'boq-1',materialRequests,overrides,totalDone:99}).available_for_use,0);
});

test('normalizeProjectMaterialOverrideInput requires positive finite qty and nonblank trimmed reason',()=>{
  for(const bad of [
    {qty:0,reason:'ok'},
    {qty:-1,reason:'ok'},
    {qty:'nope',reason:'ok'},
    {qty:1,reason:''},
    {qty:1,reason:'   '}
  ]) assert.throws(()=>normalizeProjectMaterialOverrideInput(bad));
  assert.deepEqual(normalizeProjectMaterialOverrideInput({qty:'2.5',reason:'  kebutuhan tambahan lapangan  '}),{
    qty:2.5,
    reason:'kebutuhan tambahan lapangan'
  });
});
