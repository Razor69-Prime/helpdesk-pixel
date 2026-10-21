'use strict';
const assert=require('assert');
const path=require('path');
const target=path.join(__dirname,'..','accounting-sales-v1');
let acc;
try{acc=require(target);}catch(e){console.error('EXPECTED RED: accounting-sales-v1 module missing');process.exit(1);}

const {
  ACCOUNTING_COLUMNS,
  CLASSIFICATIONS,
  SUB_CLASSIFICATIONS,
  PAID_STATUSES,
  SALES_TYPES,
  calculateAccountingAmounts,
  normalizeAccountingTransactionInput,
  resolveAccountingClassification
}=acc;

function test(name,fn){try{fn();console.log('PASS',name);}catch(e){console.error('FAIL',name,'\n ',e.stack||e);process.exitCode=1;}}

test('keeps exact 16-column workbook order',()=>{
  assert.deepStrictEqual(ACCOUNTING_COLUMNS,[
    'TANGGAL','KLASIFIKASI','SUB KLASIFIKASI','NAMA CUSTOMER - PEKERJAAN','TRANSAKSI',
    'NOMINAL TRANSAKSI','HPP','NET','DPP','PPN','KATEGORI PRODUK','METODE PEMBAYARAN',
    'STATUS PAID','PENJ. BARANG','PENJ. JASA','PIC'
  ]);
});

test('calculates DPP PPN NET with workbook integer rounding',()=>{
  assert.deepStrictEqual(calculateAccountingAmounts(10000000,6000000),{
    gross_amount:10000000,hpp_amount:6000000,dpp_amount:9009009,ppn_amount:990991,net_amount:3009009
  });
  assert.deepStrictEqual(calculateAccountingAmounts(165000,120800),{
    gross_amount:165000,hpp_amount:120800,dpp_amount:148649,ppn_amount:16351,net_amount:27849
  });
});

test('rejects negative gross and hpp',()=>{
  assert.throws(()=>calculateAccountingAmounts(-1,0),/nominal/i);
  assert.throws(()=>calculateAccountingAmounts(1,-1),/hpp/i);
});

test('normalizes valid transaction and ignores client-calculated values',()=>{
  const row=normalizeAccountingTransactionInput({
    transaction_date:'2026-10-20',classification:'B2C',sub_classification:'Project',customer_name:'Budi',job_name:'Rumah',
    transaction_description:'Instalasi CCTV',gross_amount:10000000,hpp_amount:6000000,dpp_amount:1,ppn_amount:2,net_amount:3,
    product_category:'CCTV',payment_method:'Transfer Bank',paid_status:'PAID',sales_type:'BARANG',pic_name:'Eka'
  });
  assert.equal(row.dpp_amount,9009009);assert.equal(row.ppn_amount,990991);assert.equal(row.net_amount,3009009);
  assert.equal(row.goods_amount,10000000);assert.equal(row.service_amount,0);
});

test('rejects invalid enums and missing date',()=>{
  const base={transaction_date:'2026-10-20',classification:'B2C',sub_classification:'Project',gross_amount:1,hpp_amount:0,paid_status:'PAID',sales_type:'BARANG'};
  assert.throws(()=>normalizeAccountingTransactionInput({...base,classification:'X'}),/klasifikasi/i);
  assert.throws(()=>normalizeAccountingTransactionInput({...base,sub_classification:'X'}),/sub klasifikasi/i);
  assert.throws(()=>normalizeAccountingTransactionInput({...base,paid_status:'X'}),/status paid/i);
  assert.throws(()=>normalizeAccountingTransactionInput({...base,sales_type:'X'}),/jenis penjualan/i);
  assert.throws(()=>normalizeAccountingTransactionInput({...base,transaction_date:''}),/tanggal/i);
  assert.deepStrictEqual(CLASSIFICATIONS,['B2C','B2B','B2G','B2BG']);
  assert.deepStrictEqual(SUB_CLASSIFICATIONS,['Perdagangan','Project','Operasional']);
  assert.deepStrictEqual(PAID_STATUSES,['PAID','UNPAID']);
  assert.deepStrictEqual(SALES_TYPES,['BARANG','JASA']);
});

test('classification precedence is customer then PIC then manual',()=>{
  assert.deepStrictEqual(resolveAccountingClassification({manual:'B2C'},{default_classification:'B2G'},{default_classification:'B2B'}),{classification:'B2G',source:'CUSTOMER'});
  assert.deepStrictEqual(resolveAccountingClassification({manual:'B2C'},null,{default_classification:'B2B'}),{classification:'B2B',source:'PIC'});
  assert.deepStrictEqual(resolveAccountingClassification({manual:'B2C'},null,null),{classification:'B2C',source:'MANUAL'});
});

test('Accounting access gate is Superadmin only after role normalization',()=>{
  assert.equal(acc.isAccountingSuperadmin({role:'superadmin'}),true);
  assert.equal(acc.isAccountingSuperadmin({role:'Super Admin'}),true);
  for(const role of ['admin','manager','accounting','hr','sales','technician']) assert.equal(acc.isAccountingSuperadmin({role}),false);
});

test('Accounting store declares only isolated accounting tables',()=>{
  const store=require('../accounting-sales-store');
  assert.ok(Object.values(store.ACCOUNTING_TABLES).every(name=>name.startsWith('accounting_')));
  assert.equal(Object.values(store.ACCOUNTING_TABLES).some(name=>/crm|sales_orders|inventory|work_order|project|invoice/.test(name)),false);
});

test('Accounting UI contract is Superadmin-only and permission remains placeholder',()=>{
  const fs=require('fs');
  const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-accounting-sales-v1.js'),'utf8');
  const loader=fs.readFileSync(path.join(__dirname,'..','public','pxl-urg-0018-account-permission-explicit-override.js'),'utf8');
  assert.match(ui,/superadmin/);
  assert.match(loader,/accounting_transaction_report/);
  assert.match(loader,/tab-accounting/);
  assert.match(loader,/PXL-ACC-0001G/);
  assert.doesNotMatch(ui,/custom_menus.*accounting_transaction_report[\s\S]{0,120}canOpenAccounting/);
});

test('Accounting browser bundle preserves exact workbook column order',()=>{
  const fs=require('fs');
  const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-accounting-sales-v1.js'),'utf8');
  const expected=['TANGGAL','KLASIFIKASI','SUB KLASIFIKASI','NAMA CUSTOMER - PEKERJAAN','TRANSAKSI','NOMINAL TRANSAKSI','HPP','NET','DPP','PPN','KATEGORI PRODUK','METODE PEMBAYARAN','STATUS PAID','PENJ. BARANG','PENJ. JASA','PIC'];
  let at=-1;
  for(const h of expected){const next=ui.indexOf(`'${h}'`,at+1);assert.ok(next>at,`header ${h} tidak berurutan di bundle UI`);at=next;}
  assert.match(ui,/classification_source/);
  assert.match(ui,/MANUAL_OVERRIDE/);
  assert.match(ui,/gross_amount/);
  assert.match(ui,/hpp_amount/);
});

test('dashboard aggregation returns summaries and Accounting chart series',()=>{
  const rows=[
    {transaction_date:'2026-10-01',classification:'B2C',sub_classification:'Project',product_category:'CCTV',pic_name:'Eka',gross_amount:1110000,hpp_amount:500000,dpp_amount:1000000,ppn_amount:110000,net_amount:500000,goods_amount:1110000,service_amount:0},
    {transaction_date:'2026-10-02',classification:'B2B',sub_classification:'Operasional',product_category:'Jaringan',pic_name:'Budha',gross_amount:555000,hpp_amount:200000,dpp_amount:500000,ppn_amount:55000,net_amount:300000,goods_amount:0,service_amount:555000}
  ];
  const d=acc.aggregateAccountingDashboard(rows);
  assert.deepStrictEqual(d.summary,{gross_amount:1665000,hpp_amount:700000,dpp_amount:1500000,ppn_amount:165000,net_amount:800000,transaction_count:2});
  assert.equal(d.charts.revenue_by_classification.find(x=>x.name==='B2C').value,1110000);
  assert.equal(d.charts.goods_vs_services.find(x=>x.name==='Jasa').value,555000);
  assert.equal(d.charts.monthly_revenue[0].name,'2026-10');
});

test('dashboard route and browser charts are wired inside Accounting module',()=>{
  const fs=require('fs');
  const routes=fs.readFileSync(path.join(__dirname,'..','accounting-sales-routes.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-accounting-sales-v1.js'),'utf8');
  assert.match(routes,/router\.get\('\/dashboard'/);
  for(const key of ['revenue_by_classification','transactions_by_classification','revenue_by_sub_classification','revenue_by_category','goods_vs_services','revenue_by_pic','net_by_classification','monthly_revenue']) assert.match(ui,new RegExp(key));
});

test('Excel export endpoint and authenticated browser download are wired',()=>{
  const fs=require('fs');
  const routes=fs.readFileSync(path.join(__dirname,'..','accounting-sales-routes.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'..','public','pxl-accounting-sales-v1.js'),'utf8');
  assert.match(routes,/router\.get\('\/export'/);
  assert.match(routes,/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(ui,/pxlAccountingExport/);
  assert.match(ui,/Authorization/);
});

if(process.exitCode)process.exit(process.exitCode);
console.log('Accounting Sales V1 tests complete');
