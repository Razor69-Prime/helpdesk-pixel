'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ExcelJS=require('exceljs');
const {parseExcelNumber,parseRupiahPrice}=require('../pxl-urg-0137-so-excel-rupiah');

test('0137 imports Indonesian IDR values ignoring cents without multiplying by 100',()=>{
  const cases=[
    [181818.09,181818],
    [242424.8,242424],
    [3030.3,3030],
    ['IDR                181.818,09',181818],
    ['IDR                242.424,80',242424],
    ['IDR                  3.030,30',3030],
    ['Rp 1.234.567,99',1234567],
    ['181818.09',181818],
    ['242,424.80',242424],
    ['1.234.567',1234567],
    ['2.500',2500],
    ['IDR 0,99',0],
    [{formula:'100+5.75',result:105.75},105],
    [{text:'Rp 4.500,90'},4500],
    [{richText:[{text:'IDR '},{text:'5.000,50'}]},5000],
    [null,0],['',0],['invalid',0],
    [-181818.09,0]
  ];
  for(const [raw,expected] of cases)assert.equal(parseRupiahPrice(raw),expected,JSON.stringify(raw));
});

test('0137 preserves numeric and fractional quantities separately from rupiah prices',()=>{
  for(const [raw,expected] of [[4,4],[1.5,1.5],['1,25',1.25],['1.234',1234],['1,234.50',1234.5],['1.234,50',1234.5]]){
    assert.equal(parseExcelNumber(raw),expected,String(raw));
  }
  assert.equal(parseRupiahPrice('181.818,99'),181818,'truncate cents, do not round');
  const src=fs.readFileSync(path.join(__dirname,'../pxl-urg-0036-so-excel-import.js'),'utf8');
  assert.match(src,/qty:cQty\?Math\.max\(0,num\(row\.getCell\(cQty\)\.value\)\):0/);
  assert.match(src,/unit_price:cPrice\?parseRupiahPrice\(row\.getCell\(cPrice\)\.value\):0/);
  assert.doesNotMatch(src,/unit_price:cPrice\?Math\.max\(0,num\(/);
});

test('0137 real XLSX preview returns integer IDR for numeric, formatted and text cells, without writing SO',async()=>{
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('SO Items');
  sheet.addRow(['Tipe','Nama Item / Jasa','SKU','Qty','Satuan','Harga Satuan','Keterangan']);
  const scenarios=[
    ['Material','Kamera A',1,'pcs',181818.09,181818],
    ['Material','Kamera B',2.5,'pcs','IDR          242.424,80',242424],
    ['Jasa','Instalasi C','1,5','titik','IDR              3.030,30',3030],
    ['Material','Kabel D',3,'meter','181818.09',181818],
    ['Material','NVR E',1,'pcs',{formula:'2000+0.99',result:2000.99},2000]
  ];
  for(const [type,name,qty,unit,price] of scenarios){
    const row=sheet.addRow([type,name,'',qty,unit,price,'test']);
    if(typeof price==='number')row.getCell(6).numFmt='"IDR" #,##0.00';
  }
  const buffer=await workbook.xlsx.writeBuffer();
  // Exercise the real upload/preview handler and authentication, not a mock parser.
  require('../pxl-urg-0036-so-excel-import.js');
  const express=require('express');
  const app=express();
  app.use(function attachSession(req,res,next){
    const _setUser=()=>{};
    req.session={user:req.headers.authorization==='Bearer test'?{role:'sales'}:null};
    next();
  });
  const server=await new Promise(resolve=>{
    const s=app.listen(0,'127.0.0.1',()=>resolve(s));
  });
  const url='http://127.0.0.1:'+server.address().port+'/api/sales-orders/import-preview';
  const upload=()=>{const form=new FormData();form.append('file',new Blob([buffer]),'sample.xlsx');return form;};
  try{
    const unauthorized=await fetch(url,{method:'POST',body:upload()});
    assert.equal(unauthorized.status,401);
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer test'},body:upload()});
    assert.equal(response.status,200,'SO import preview endpoint reachable');
    const payload=await response.json();
    assert.equal(payload.rows.length,scenarios.length);
    for(let i=0;i<scenarios.length;i++){
      const [type,name,qty,unit,price,expected]=scenarios[i];
      const row=payload.rows[i];
      assert.equal(row.name,name);
      assert.equal(row.type,type);
      assert.equal(row.qty,i===2?1.5:qty);
      assert.equal(row.unit_price,expected,'Harga '+name);
      assert.equal(Number.isInteger(row.unit_price),true);
    }
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
