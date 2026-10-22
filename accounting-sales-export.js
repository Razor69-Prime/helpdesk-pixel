'use strict';
const ExcelJS=require('exceljs');
const {ACCOUNTING_COLUMNS}=require('./accounting-sales-v1');
const MONTHS=['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
const FILL='FF9A4F20',WHITE='FFFFFFFF',BLACK='FF2F2F2F';
function monthSheetName(period){const m=Number(String(period||'').slice(5,7));if(!m||m<1||m>12)throw new Error('Periode export tidak valid.');return MONTHS[m-1];}
function rowValues(r,options={}){
  const values=[
    r.transaction_date?new Date(`${String(r.transaction_date).slice(0,10)}T00:00:00`):null,
    r.classification||'',r.sub_classification||'',
    [r.customer_name,r.job_name].filter(Boolean).join(' - '),r.transaction_description||'',
    Number(r.gross_amount||0),Number(r.hpp_amount||0),Number(r.net_amount||0),Number(r.dpp_amount||0),Number(r.ppn_amount||0),
    r.product_category||'',r.payment_method||'',r.paid_status||'',Number(r.goods_amount||0),Number(r.service_amount||0),r.pic_name||''
  ];
  return options.scope==='all'?[r.outlet_name||r.outlet_code||r.outlet_id||'',...values]:values;
}
function excelCol(n){let s='';for(;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function styleSheet(ws,rows,options={}){
  const combined=options.scope==='all',headers=combined?['OUTLET',...ACCOUNTING_COLUMNS]:ACCOUNTING_COLUMNS;
  const offset=combined?1:0,last=headers.length,lastCol=excelCol(last);
  ws.mergeCells(`A1:${lastCol}1`);
  const month=String(ws.name||'').toUpperCase();
  const title=ws.getCell('A1');title.value=month;title.fill={type:'pattern',pattern:'solid',fgColor:{argb:FILL}};title.font={bold:true,color:{argb:WHITE},size:12};title.alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=22;
  const totals={gross:0,hpp:0,net:0,dpp:0,ppn:0};for(const r of rows){totals.gross+=Number(r.gross_amount||0);totals.hpp+=Number(r.hpp_amount||0);totals.net+=Number(r.net_amount||0);totals.dpp+=Number(r.dpp_amount||0);totals.ppn+=Number(r.ppn_amount||0);}
  const totalCols={gross:6+offset,hpp:7+offset,net:8+offset,dpp:9+offset,ppn:10+offset};
  for(const [k,c] of Object.entries(totalCols))ws.getRow(2).getCell(c).value=totals[k];
  ws.getRow(3).values=headers;
  for(let c=1;c<=last;c++){const cell=ws.getRow(3).getCell(c);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:FILL}};cell.font={bold:true,color:{argb:WHITE},size:9};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};cell.border={top:{style:'thin',color:{argb:BLACK}},left:{style:'thin',color:{argb:BLACK}},bottom:{style:'thin',color:{argb:BLACK}},right:{style:'thin',color:{argb:BLACK}}};}
  ws.getRow(3).height=30;
  rows.forEach(r=>ws.addRow(rowValues(r,options)));
  const wrap=new Set((combined?[5,6,12,13]:[4,5,11,12]));
  for(let r=4;r<=ws.rowCount;r++)for(let c=1;c<=last;c++){const cell=ws.getRow(r).getCell(c);cell.border={top:{style:'thin',color:{argb:BLACK}},left:{style:'thin',color:{argb:BLACK}},bottom:{style:'thin',color:{argb:BLACK}},right:{style:'thin',color:{argb:BLACK}}};cell.alignment={vertical:'top',wrapText:wrap.has(c)};}
  const moneyCols=[6,7,8,9,10,14,15].map(c=>c+offset);moneyCols.forEach(c=>ws.getColumn(c).numFmt='"Rp" #,##0');
  ws.getColumn(1+offset).numFmt='dd/mm/yyyy';Object.values(totalCols).forEach(c=>ws.getRow(2).getCell(c).numFmt='"Rp" #,##0');
  const widths=[12,12,16,28,36,18,16,16,16,16,24,22,14,16,16,18];if(combined)widths.unshift(14);ws.columns.forEach((col,i)=>{col.width=widths[i]||14;});
  ws.views=[{state:'frozen',ySplit:3,xSplit:0}];ws.autoFilter={from:'A3',to:`${lastCol}${Math.max(3,ws.rowCount)}`};
}
async function buildAccountingWorkbook(periodRows={},options={}){
  const scope=options.scope==='all'?'all':'outlet';
  const wb=new ExcelJS.Workbook();wb.creator='PixelApps Accounting';wb.created=new Date();
  const periods=Object.keys(periodRows).sort();if(!periods.length)throw new Error('Tidak ada periode untuk diexport.');
  const monthCounts=periods.reduce((m,p)=>{const n=monthSheetName(p);m[n]=(m[n]||0)+1;return m;},{});
  for(const period of periods){
    const month=monthSheetName(period),year=String(period).slice(0,4),name=monthCounts[month]>1?`${month} ${year}`:month;
    let rows=Array.isArray(periodRows[period])?periodRows[period]:[];
    if(scope==='outlet'&&options.outletId)rows=rows.filter(r=>String(r.outlet_id||'')===String(options.outletId));
    const ws=wb.addWorksheet(name);styleSheet(ws,rows,{...options,scope});
  }
  return wb;
}
module.exports={buildAccountingWorkbook,monthSheetName,rowValues};
