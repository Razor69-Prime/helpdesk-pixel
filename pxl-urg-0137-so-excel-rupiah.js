'use strict';
// PXL-URG-0137 — distinguish genuine XLSX numeric values from formatted rupiah text.
// Do not remove decimal dots from numeric ExcelJS cell values.
function parseExcelNumber(value){
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  if(value&&typeof value==='object'){
    if(Object.hasOwn(value,'result'))return parseExcelNumber(value.result);
    if(typeof value.text==='string')return parseExcelNumber(value.text);
    if(Array.isArray(value.richText))return parseExcelNumber(value.richText.map(p=>p.text||'').join(''));
    return 0;
  }
  const raw=String(value??'').trim().replace(/\u2212/g,'-').replace(/[^0-9.,-]/g,'');
  if(!raw||raw==='-')return 0;
  const negative=raw.startsWith('-');
  const s=raw.replace(/-/g,'');
  const lastDot=s.lastIndexOf('.');
  const lastComma=s.lastIndexOf(',');
  let decimal=null;
  if(lastDot>=0&&lastComma>=0)decimal=lastDot>lastComma?'.':',';
  else if(lastComma>=0&&!/^\d{1,3}(?:,\d{3})+$/.test(s))decimal=',';
  else if(lastDot>=0&&!/^\d{1,3}(?:\.\d{3})+$/.test(s))decimal='.';
  let normalized;
  if(decimal){
    const split=s.lastIndexOf(decimal);
    normalized=s.slice(0,split).replace(/[.,]/g,'')+'.'+s.slice(split+1).replace(/[.,]/g,'');
  }else normalized=s.replace(/[.,]/g,'');
  const parsed=Number((negative?'-':'')+normalized);
  return Number.isFinite(parsed)?parsed:0;
}
// Rupiah price is intentionally stored without cents (truncated, not rounded).
function parseRupiahPrice(value){
  return Math.max(0,Math.trunc(parseExcelNumber(value)));
}
module.exports={parseExcelNumber,parseRupiahPrice};
