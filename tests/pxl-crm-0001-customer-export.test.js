'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ExcelJS=require('exceljs');
const express=require('express');
const {allowed,buildWorkbook,CATEGORIES}=require('../pxl-crm-0001-customer-export');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const customers=[
  {id:'cus-001',name:'Toko Grosir Bali',phone:'08123456789',sales_pic:'Tim Sales',type:'B2B',market_segment:'B2B',sector:'Retail',status:'active',address:'Denpasar, Bali',created_at:'2026-10-20T03:00:00.000Z'},
  {id:'cus-002',name:'Konsumen Langsung',phone:'08234567890',sales_pic:'Sales 2',type:'B2C',market_segment:'B2C',sector:'End User',status:'active',address:'Badung',created_at:'2026-11-01T00:00:00Z'},
  {id:'cus-003',name:'=INJECT()',phone:'000123',type:'B2B',market_segment:'Unclassified',sector:null,status:'inactive',address:''}
];

test('CRM export classification permissions: Superadmin or dedicated segmentation permission only',()=>{
  assert.equal(allowed({role:'superadmin'}),true);
  assert.equal(allowed({role:'manager',custom_menus:['customer_segment_manage']}),true);
  assert.equal(allowed({role:'sales',custom_menus:['customer_segment_bulk_manage']}),true);
  assert.equal(allowed({role:'sales',custom_menus:[]}),false);
  assert.equal(allowed({role:'accounting'}),false);
  assert.equal(allowed(null),false);
  assert.deepEqual(CATEGORIES,['B2B','B2B Grosir','B2C']);
});

test('CRM export builds customer XLSX with stable IDs, original classification, phone text and editable dropdown',async()=>{
  const original=JSON.parse(JSON.stringify(customers));
  const book=buildWorkbook(customers);
  const buffer=Buffer.from(await book.xlsx.writeBuffer());
  assert.ok(buffer.length>2000);
  const reloaded=new ExcelJS.Workbook();await reloaded.xlsx.load(buffer);
  const s=reloaded.getWorksheet('Klasifikasi Customer');
  const guide=reloaded.getWorksheet('Panduan');
  assert.ok(s&&guide);
  assert.equal(s.getCell('A5').value,'No');
  assert.equal(s.getCell('J5').value,'Klasifikasi Baru (Isi)');
  assert.equal(s.getCell('B6').value,'cus-001');
  assert.equal(s.getCell('C6').value,'Toko Grosir Bali');
  assert.equal(s.getCell('D6').value,'08123456789');
  assert.equal(s.getCell('G6').value,'B2B');
  assert.equal(s.getCell('H6').value,'Retail');
  assert.equal(s.getCell('J6').value,'');
  assert.equal(s.getCell('B7').value,'cus-002');
  assert.equal(s.getCell('G7').value,'B2C');
  assert.equal(s.getCell('J7').value,'');
  assert.equal(s.getCell('D8').value,'000123');
  assert.equal(s.getCell('C8').value,"'=INJECT()", 'spreadsheet formula injection escaped');
  assert.equal(s.getColumn(4).numFmt,'@');
  assert.equal(s.dataValidations.model['J6'].type,'list');
  assert.deepEqual(s.dataValidations.model['J8'].formulae,['"B2B,B2B Grosir,B2C"']);
  assert.ok(guide.getCell('C6').value.toLowerCase().includes('tidak otomatis'));
  assert.deepEqual(customers,original,'building workbook never changes original customer objects');
});

test('CRM export endpoint uses existing CRM auth and restricts phone/address export',async()=>{
  const dbKey=require.resolve('../db');
  const original=require.cache[dbKey];
  const calls=[];
  require.cache[dbKey]={id:dbKey,filename:dbKey,loaded:true,exports:{getCrmCustomers:async()=>{calls.push('read');return customers;}}};
  const app=express();
  const readAuth=(req,res,next)=>{
    const kind=req.headers.authorization;
    req.session={user:kind==='Bearer admin'?{role:'superadmin'}:kind==='Bearer segment'?{role:'manager',custom_menus:['customer_segment_manage']}:
      kind==='Bearer ordinary'?{role:'sales'}:null};
    if(!req.session.user)return res.status(401).json({error:'Unauthorized'});
    next();
  };
  app.get('/api/crm/report',readAuth,(_req,res)=>res.json({customers:[]}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  const url='http://127.0.0.1:'+server.address().port+'/api/crm/customers/export-classification';
  try{
    const unauth=await fetch(url);
    assert.equal(unauth.status,401);
    const blocked=await fetch(url,{headers:{Authorization:'Bearer ordinary'}});
    assert.equal(blocked.status,403);
    assert.equal(calls.length,0);
    for(const token of ['admin','segment']){
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token}});
      assert.equal(response.status,200);
      assert.match(response.headers.get('content-type'),/spreadsheetml/);
      assert.match(response.headers.get('content-disposition'),/PixelApps_Klasifikasi_Customer_\d{8}\.xlsx/);
      assert.match(response.headers.get('cache-control'),/no-store/);
      const buffer=Buffer.from(await response.arrayBuffer());
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
      assert.equal(workbook.getWorksheet('Klasifikasi Customer').getCell('C6').value,'Toko Grosir Bali');
    }
    assert.equal(calls.length,2,'only authorized requests read database');
  }finally{
    await new Promise(resolve=>server.close(resolve));
    if(original)require.cache[dbKey]=original;else delete require.cache[dbKey];
  }
});

test('CRM frontend adds real download action and visibility is permission-aware',()=>{
  const html=read('public/crm.html');
  assert.match(html,/id="customerExportBtn"/);
  assert.match(html,/onclick="exportCustomerClassification\(\)"/);
  assert.match(html,/function canExportCustomerClassification\(\)/);
  assert.match(html,/exportBtn\.style\.display=canExportCustomerClassification\(\)/);
  assert.match(html,/fetch\('\/api\/crm\/customers\/export-classification',\{headers:H\(\),cache:'no-store'\}\)/);
  assert.match(html,/URL\.createObjectURL\(blob\)/);
  assert.match(html,/link\.click\(\)/);
  assert.doesNotMatch(html,/POST.*\/api\/crm\/customers\/export-classification/);
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0);
  for(const part of scripts)new vm.Script(part[1]);
  assert.match(read('pxl-stg-0004f.js'),/require\('\.\/pxl-crm-0001-customer-export'\)/);
});

test('CRM empty database still exports a well-formed classification template',async()=>{
  const book=buildWorkbook([]);
  const buffer=Buffer.from(await book.xlsx.writeBuffer());
  const restored=new ExcelJS.Workbook();await restored.xlsx.load(buffer);
  const s=restored.getWorksheet('Klasifikasi Customer');
  assert.equal(s.getCell('A3').value.includes('0'),true);
  assert.equal(s.getCell('J5').value,'Klasifikasi Baru (Isi)');
  assert.ok(s.dataValidations.model['J6']);
});
