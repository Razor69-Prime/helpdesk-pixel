'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/pxl-sales-bill-0001.js','utf8');
const win={};const doc={addEventListener(){},getElementById(){return null}};
vm.runInNewContext(source,{window:win,document:doc,setTimeout(){},console});
const filter=win.PXL_SALES_BILL_0001.filterRows;
const rows=[
 {wo_number:'WO-1',status:'pending_note',revenue_amount:250000,customer_name:'A'},
 {wo_number:'WO-2',status:'needs_review',revenue_amount:null,customer_name:'B'},
 {wo_number:'WO-3',status:'noted',revenue_amount:500000,customer_name:'C'},
 {wo_number:'WO-4',status:'no_revenue',revenue_amount:null,customer_name:'D'},
 {wo_number:'WO-5',status:'pending_note',revenue_amount:100000,customer_name:'E'},
 {wo_number:'WO-6',status:'needs_review',revenue_amount:0,customer_name:'F'},
];
test('new Sudah Ada Omzet option finds positive amounts regardless of nota status and sorts descending',()=>{
 assert.deepEqual(Array.from(filter(rows,'has_revenue',''),x=>x.wo_number),['WO-3','WO-1','WO-5']);
 assert.match(source,/<option value="has_revenue">Sudah Ada Omzet<\/option>/);
});
test('six existing filter options preserve original meaning',()=>{
 assert.equal(filter(rows,'open','').length,4);
 assert.equal(filter(rows,'all','').length,6);
 assert.equal(filter(rows,'pending_note','').length,2);
 assert.equal(filter(rows,'needs_review','').length,2);
 assert.equal(filter(rows,'noted','').length,1);
 assert.equal(filter(rows,'no_revenue','').length,1);
});
test('positive omzet option combines with existing customer search',()=>{
 assert.deepEqual(Array.from(filter(rows,'has_revenue','customer-nonexistent'),x=>x.wo_number),[]);
 assert.deepEqual(Array.from(filter(rows,'has_revenue','WO-5'),x=>x.wo_number),['WO-5']);
});
test('UI revision is cache-busted without changing back-end or database',()=>{
 const html=fs.readFileSync('public/index.html','utf8');
 assert.match(html,/pxl-sales-bill-0001\.js\?v=PXL-SALES-BILL-0002/);
 const {execFileSync}=require('node:child_process');const changes=execFileSync('git',['status','--porcelain'],{encoding:'utf8'});
 assert.doesNotMatch(changes,/server\.js|db-core\.js|\.sql/);
});
