'use strict';
const ExcelJS=require('exceljs');
const {ACCOUNTING_COLUMNS}=require('./accounting-sales-v1');
const MONTHS=['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
const FILL='FF9A4F20',WHITE='FFFFFFFF',BLACK='FF2F2F2F';
function monthSheetName(period){const m=Number(String(period||'').slice(5,7));if(!m||m<1||m>12)throw new Error('Periode export tidak valid.');return MONTHS[m-1];}
function rowValues(r){return[
  r.transaction_date?new Date(`${String(r.transaction_date).slice(0,10)}T00:00:00`):null,
  r.classification||'',r.sub_classification||'',
  [r.customer_name,r.job_name].filter(Boolean).join(' - '),r.transaction_description||'',
  Number(r.gross_amount||0),Number(r.hpp_amount||0),Number(r.net_amount||0),Number(r.dpp_amount||0),Number(r.ppn_amount||0),
  r.product_category||'',r.payment_method||'',r.paid_status||'',Number(r.goods_amount||0),Number(r.service_amount||0),r.pic_name||''
];}
function styleSheet(ws,rows){
  ws.mergeCells('A1:P1');
  const month=String(ws.name||'').toUpperCase();
  const title=ws.getCell('A1');title.value=month;title.fill={type:'pattern',pattern:'solid',fgColor:{argb:FILL}};title.font={bold:true,color:{argb:WHITE},size:12};title.alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=22;
  const totals={gross:0,hpp:0,net:0,dpp:0,ppn:0};for(const r of rows){totals.gross+=Number(r.gross_amount||0);totals.hpp+=Number(r.hpp_amount||0);totals.net+=Number(r.net_amount||0);totals.dpp+=Number(r.dpp_amount||0);totals.ppn+=Number(r.ppn_amount||0);}ws.getCell('F2').value=totals.gross;ws.getCell('G2').value=totals.hpp;ws.getCell('H2').value=totals.net;ws.getCell('I2').value=totals.dpp;ws.getCell('J2').value=totals.ppn;
  ws.getRow(3).values=ACCOUNTING_COLUMNS;
  for(let c=1;c<=16;c++){const cell=ws.getRow(3).getCell(c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:FILL}};cell.font={bold:true,color:{argb:WHITE},size:9};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};cell.border={top:{style:'thin',color:{argb:BLACK}},left:{style:'thin',color:{argb:BLACK}},bottom:{style:'thin',color:{argb:BLACK}},right:{style:'thin',color:{argb:BLACK}}};}
  ws.getRow(3).height=30;
  rows.forEach(r=>ws.addRow(rowValues(r)));
  for(let r=4;r<=ws.rowCount;r++)for(let c=1;c<=16;c++){const cell=ws.getRow(r).getCell(c);cell.border={top:{style:'thin',color:{argb:BLACK}},left:{style:'thin',color:{argb:BLACK}},bottom:{style:'thin',color:{argb:BLACK}},right:{style:'thin',color:{argb:BLACK}}};cell.alignment={vertical:'top',wrapText:[4,5,11,12].includes(c)};}
  ['F','G','H','I','J','N','O'].forEach(col=>ws.getColumn(col).numFmt='"Rp" #,##0');ws.getColumn('A').numFmt='dd/mm/yyyy';['F','G','H','I','J'].forEach(col=>ws.getCell(`${col}2`).numFmt='"Rp" #,##0');
  ws.columns.forEach((col,i)=>{col.width=[12,12,16,28,36,18,16,16,16,16,24,22,14,16,16,18][i]||14;});
  ws.views=[{state:'frozen',ySplit:3,xSplit:0}];ws.autoFilter={from:'A3',to:`P${Math.max(3,ws.rowCount)}`};
}
async function buildAccountingWorkbook(periodRows={}){
  const wb=new ExcelJS.Workbook();wb.creator='PixelApps Accounting';wb.created=new Date();
  const periods=Object.keys(periodRows).sort();if(!periods.length)throw new Error('Tidak ada periode untuk diexport.');
  const monthCounts=periods.reduce((m,p)=>{const n=monthSheetName(p);m[n]=(m[n]||0)+1;return m;},{});
  for(const period of periods){const month=monthSheetName(period),year=String(period).slice(0,4);const name=monthCounts[month]>1?`${month} ${year}`:month;const ws=wb.addWorksheet(name);styleSheet(ws,Array.isArray(periodRows[period])?periodRows[period]:[]);}
  return wb;
}
module.exports={buildAccountingWorkbook,monthSheetName,rowValues};
