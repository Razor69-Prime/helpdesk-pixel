'use strict';
const assert=require('assert');
const ExcelJS=require('exceljs');
const {buildAccountingWorkbook}=require('../accounting-sales-export');
const {accountingExportFilename}=require('../accounting-sales-routes');
const B='11111111-1111-4111-8111-111111111111';
const L='22222222-2222-4222-8222-222222222222';
const base={transaction_date:'2026-10-02',classification:'B2C',sub_classification:'Project',customer_name:'Budi',job_name:'Rumah',transaction_description:'Instalasi',gross_amount:1110000,hpp_amount:500000,net_amount:500000,dpp_amount:1000000,ppn_amount:110000,product_category:'CCTV',payment_method:'Transfer Bank',paid_status:'PAID',goods_amount:1110000,service_amount:0,pic_name:'Eka'};
(async()=>{
  const rows=[{...base,id:'b',outlet_id:B,outlet_name:'Buduk'},{...base,id:'l',outlet_id:L,outlet_name:'Lukluk',gross_amount:2220000}];
  let wb=await buildAccountingWorkbook({'2026-10':rows},{scope:'outlet',outletName:'Buduk',outletId:B});
  let buf=await wb.xlsx.writeBuffer();let check=new ExcelJS.Workbook();await check.xlsx.load(buf);let ws=check.getWorksheet('OKTOBER');
  assert.equal(ws.getRow(3).values.slice(1).length,16);assert.equal(ws.getCell('A3').value,'TANGGAL');assert.equal(ws.getCell('P3').value,'PIC');assert.equal(ws.rowCount,4);assert.equal(ws.getCell('F4').value,1110000);
  wb=await buildAccountingWorkbook({'2026-10':rows},{scope:'all'});buf=await wb.xlsx.writeBuffer();check=new ExcelJS.Workbook();await check.xlsx.load(buf);ws=check.getWorksheet('OKTOBER');
  assert.equal(ws.getRow(3).values.slice(1).length,17);assert.equal(ws.getCell('A3').value,'OUTLET');assert.equal(ws.getCell('B3').value,'TANGGAL');assert.equal(ws.getCell('Q3').value,'PIC');assert.equal(ws.getCell('A4').value,'Buduk');assert.equal(ws.getCell('A5').value,'Lukluk');
  assert.equal(accountingExportFilename('outlet','Buduk','2026-10'),'Accounting_Buduk_2026-10.xlsx');
  assert.equal(accountingExportFilename('all','','2026-10'),'Accounting_Semua_Outlet_2026-10.xlsx');
  console.log('Accounting multi-outlet export tests complete');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
