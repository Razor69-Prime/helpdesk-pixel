'use strict';
const assert=require('assert');
const {
  normalizeOutletId,filterTransactions,aggregateAccountingDashboard,calculateAccountingAmounts
}=require('../accounting-sales-v1');

const B='11111111-1111-4111-8111-111111111111';
const L='22222222-2222-4222-8222-222222222222';
const G='33333333-3333-4333-8333-333333333333';

assert.throws(()=>normalizeOutletId(''),/Outlet wajib dipilih\./);
assert.throws(()=>normalizeOutletId('not-a-uuid'),/Outlet wajib dipilih\./);
assert.equal(normalizeOutletId(` ${B} `),B);
assert.deepEqual(calculateAccountingAmounts(10000000,6000000),{gross_amount:10000000,hpp_amount:6000000,dpp_amount:9009009,ppn_amount:990991,net_amount:3009009});

const rows=[
  {id:'1',outlet_id:B,outlet_name:'Buduk',transaction_date:'2026-10-01',classification:'B2C',sub_classification:'Project',product_category:'CCTV',pic_name:'Eka',gross_amount:100,hpp_amount:40,dpp_amount:90,ppn_amount:10,net_amount:50,goods_amount:100,service_amount:0},
  {id:'2',outlet_id:L,outlet_name:'Lukluk',transaction_date:'2026-10-02',classification:'B2B',sub_classification:'Perdagangan',product_category:'Jaringan',pic_name:'Eka',gross_amount:200,hpp_amount:80,dpp_amount:180,ppn_amount:20,net_amount:100,goods_amount:200,service_amount:0},
  {id:'3',outlet_id:G,outlet_name:'Bangli',transaction_date:'2026-10-03',classification:'B2C',sub_classification:'Operasional',product_category:'CCTV',pic_name:'Made',gross_amount:300,hpp_amount:100,dpp_amount:270,ppn_amount:30,net_amount:170,goods_amount:0,service_amount:300}
];
assert.deepEqual(filterTransactions(rows,{outlet_id:L}).map(x=>x.id),['2']);

const all=aggregateAccountingDashboard(rows,{scope:'all'});
assert.equal(all.summary.gross_amount,600);
assert.equal(all.summary.net_amount,320);
assert.equal(all.summary.transaction_count,3);
assert.deepEqual(all.charts.revenue_by_outlet,[{name:'Buduk',value:100},{name:'Lukluk',value:200},{name:'Bangli',value:300}]);
assert.deepEqual(all.charts.net_by_outlet,[{name:'Buduk',value:50},{name:'Lukluk',value:100},{name:'Bangli',value:170}]);
assert.equal(all.outlet_breakdown.length,3);
assert.deepEqual(all.outlet_breakdown.map(x=>[x.outlet_name,x.summary.gross_amount]),[['Buduk',100],['Lukluk',200],['Bangli',300]]);
const pics=Object.fromEntries(all.charts.revenue_by_pic.map(x=>[x.name,x.value]));
assert.equal(pics['Buduk / Eka'],100);
assert.equal(pics['Lukluk / Eka'],200);
assert.equal(pics.Eka,undefined);

const sparse=aggregateAccountingDashboard(rows.slice(0,2),{scope:'all',outlets:[{id:B,name:'Buduk'},{id:L,name:'Lukluk'},{id:G,name:'Bangli'}]});
assert.deepEqual(sparse.charts.revenue_by_outlet,[{name:'Buduk',value:100},{name:'Lukluk',value:200},{name:'Bangli',value:0}]);
assert.deepEqual(sparse.charts.net_by_outlet,[{name:'Buduk',value:50},{name:'Lukluk',value:100},{name:'Bangli',value:0}]);
assert.deepEqual(sparse.outlet_breakdown.map(x=>[x.outlet_name,x.summary.transaction_count]),[['Buduk',1],['Lukluk',1],['Bangli',0]]);

const buduk=aggregateAccountingDashboard(filterTransactions(rows,{outlet_id:B}),{scope:'outlet'});
assert.equal(buduk.summary.gross_amount,100);
assert.equal(buduk.summary.net_amount,50);
console.log('Accounting multi-outlet core tests complete');
