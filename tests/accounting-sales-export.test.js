'use strict';
const assert=require('assert');
const ExcelJS=require('exceljs');
let exp;
try{exp=require('../accounting-sales-export');}catch(e){console.error('EXPECTED RED: accounting-sales-export module missing');process.exit(1);}
const {buildAccountingWorkbook,monthSheetName}=exp;
const {exportPeriods}=require('../accounting-sales-routes');
const COLUMNS=['TANGGAL','KLASIFIKASI','SUB KLASIFIKASI','NAMA CUSTOMER - PEKERJAAN','TRANSAKSI','NOMINAL TRANSAKSI','HPP','NET','DPP','PPN','KATEGORI PRODUK','METODE PEMBAYARAN','STATUS PAID','PENJ. BARANG','PENJ. JASA','PIC'];
(async()=>{
  assert.equal(monthSheetName('2026-10'),'OKTOBER');
  const rows=[{id:'1',transaction_date:'2026-10-02',classification:'B2C',sub_classification:'Project',customer_name:'Budi',job_name:'Rumah',transaction_description:'Instalasi CCTV',gross_amount:1110000,hpp_amount:500000,net_amount:500000,dpp_amount:1000000,ppn_amount:110000,product_category:'CCTV',payment_method:'Transfer Bank',paid_status:'PAID',goods_amount:1110000,service_amount:0,pic_name:'Eka'}];
  const wb=await buildAccountingWorkbook({'2026-10':rows});
  const buf=await wb.xlsx.writeBuffer();
  const check=new ExcelJS.Workbook();await check.xlsx.load(buf);
  const ws=check.getWorksheet('OKTOBER');
  assert.ok(ws,'sheet OKTOBER harus ada');
  assert.equal(ws.getCell('A1').value,'OKTOBER');
  assert.deepStrictEqual(ws.getRow(3).values.slice(1,17),COLUMNS);
  assert.equal(ws.getCell('F4').value,1110000);
  assert.equal(ws.getCell('G4').value,500000);
  assert.equal(ws.getCell('H4').value,500000);
  assert.equal(ws.getCell('I4').value,1000000);
  assert.equal(ws.getCell('J4').value,110000);
  assert.equal(ws.getCell('A3').fill.fgColor.argb,'FF9A4F20');
  assert.equal(ws.getCell('A3').font.color.argb,'FFFFFFFF');
  assert.ok(ws.getCell('A4').border.left.style);
  const multi=await buildAccountingWorkbook({'2026-10':rows,'2027-10':rows});
  assert.deepStrictEqual(multi.worksheets.map(x=>x.name),['OKTOBER 2026','OKTOBER 2027']);
  assert.deepStrictEqual(exportPeriods({year:'2026',annual:'1'}),[
    '2026-01','2026-02','2026-03','2026-04','2026-05','2026-06',
    '2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'
  ]);
  const annualRows=Object.fromEntries(exportPeriods({year:'2026',annual:'1'}).map(p=>[p,p==='2026-10'?rows:[]]));
  const annual=await buildAccountingWorkbook(annualRows);
  assert.deepStrictEqual(annual.worksheets.map(x=>x.name),['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER']);
  console.log('Accounting Excel export tests complete');
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
