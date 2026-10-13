'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeProjectMrItems}=require('../project-vnext-3b');

test('manual MR submit accepts DB snapshot fields after draft save',()=>{
  const rows=normalizeProjectMrItems([{
    source_type:'manual',
    project_boq_item_id:null,
    item_name_snapshot:'Kabel Dropcore 2 Core',
    unit_snapshot:'meter',
    qty_requested:100
  }],{requireItems:true});
  assert.deepEqual(rows,[{
    source_type:'manual',
    project_boq_item_id:null,
    item_name:'Kabel Dropcore 2 Core',
    unit:'meter',
    qty_requested:100,
    sort_order:0
  }]);
});
