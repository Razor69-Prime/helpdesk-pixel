'use strict';
// PXL-CRM-0001 — read-only Excel export for CRM customer classification review.
// Register beside existing authenticated /api/crm/report route; no database writes.
const express=require('express');
const ExcelJS=require('exceljs');
const oldGet=express.application.get;
const KEY=Symbol.for('pxl.crm.0001.customer.export');
const CATEGORIES=['B2B','B2B Grosir','B2C'];
const HEADERS=['No','Customer ID','Nama Customer','Nomor Telepon / WA','Sales PIC','Tipe Legacy','Market Segment Saat Ini','Sector Saat Ini','Status Customer','Klasifikasi Baru (Isi)','Alamat','Tanggal Dibuat'];

function allowed(user){
  const role=String(user?.role||'').toLowerCase();
  const perms=Array.isArray(user?.custom_menus)?user.custom_menus:[];
  return role==='superadmin'||perms.includes('customer_segment_manage')||perms.includes('customer_segment_bulk_manage');
}
function text(value){
  const string=String(value??'').trim();
  // Keep Excel text fields literal, including phone numbers and user-entered names.
  return /^[=+\-@\t\r]/.test(string)?"'"+string:string;
}
function buildWorkbook(customers){
  const wb=new ExcelJS.Workbook();
  wb.creator='PixelApps — Pixel Solusindo';
  wb.subject='Export master customer untuk review segmentasi';
  wb.created=new Date();
  const ws=wb.addWorksheet('Klasifikasi Customer',{views:[{state:'frozen',xSplit:2,ySplit:5,topLeftCell:'C6'}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  const sizes=[7,39,36,23,23,19,24,23,18,25,44,18];
  HEADERS.forEach((header,i)=>{ws.getColumn(i+1).width=sizes[i]});
  ws.mergeCells('A1:L1');
  ws.getCell('A1').value='MASTER CUSTOMER • KLASIFIKASI';
  ws.getCell('A1').font={name:'Calibri',size:17,bold:true,color:{argb:'FFFFFFFF'}};
  ws.getCell('A1').alignment={vertical:'middle'};
  ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF18283F'}};
  ws.getRow(1).height=36;
  ws.mergeCells('A2:L2');
  ws.getCell('A2').value='Isi hanya kolom J (Klasifikasi Baru) dengan pilihan B2B / B2B Grosir / B2C. Data CRM tidak berubah otomatis.';
  ws.getCell('A2').font={size:11,color:{argb:'FF8D490C'},bold:true};
  ws.getCell('A2').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF0DD'}};
  ws.getCell('A2').alignment={vertical:'middle'};
  ws.getRow(2).height=26;
  ws.mergeCells('A3:L3');
  ws.getCell('A3').value='Jumlah customer: '+customers.length+'  |  Diekspor: '+new Date().toLocaleString('id-ID',{timeZone:'Asia/Makassar'})+' WITA  |  Sumber: CRM PixelApps';
  ws.getCell('A3').font={size:10,color:{argb:'FF526078'}};
  ws.getRow(3).height=21;
  ws.getRow(4).height=10;
  ws.getRow(5).values=HEADERS;
  ws.getRow(5).height=28;
  ws.getRow(5).eachCell((cell,col)=>{
    cell.font={name:'Calibri',bold:true,color:{argb:'FFFFFFFF'},size:10};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:col===10?'FFE4752D':'FF243B56'}};
    cell.alignment={vertical:'middle',wrapText:true};
    cell.border={bottom:{style:'medium',color:{argb:'FFBFC6D0'}}};
  });
  const rows=Array.isArray(customers)?customers:[];
  rows.forEach((c,i)=>{
    const row=ws.addRow([
      i+1,text(c.id),text(c.name),text(c.phone||c.normalized_phone),text(c.sales_pic),
      text(c.type),text(c.market_segment||'Unclassified'),text(c.sector),text(c.status||'active'),
      '',text(c.address),text(c.created_at).slice(0,10)
    ]);
    row.height=22;
    row.eachCell({includeEmpty:true},(cell,col)=>{
      cell.font={name:'Calibri',size:10,color:{argb:'FF263449'}};
      cell.alignment={vertical:'middle',wrapText:false};
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:col===10?'FFFFF0DD':(i%2?'FFF4F7FB':'FFFFFFFF')}};
      cell.border={bottom:{style:'hair',color:{argb:'FFE6EAF0'}}};
    });
  });
  ws.getColumn(2).numFmt='@';
  ws.getColumn(4).numFmt='@';
  ws.getColumn(10).numFmt='@';
  const last=Math.max(6,5+rows.length);
  ws.autoFilter={from:'A5',to:'L'+last};
  ws.dataValidations.add('J6:J'+last,{
    type:'list',allowBlank:true,showErrorMessage:true,errorStyle:'stop',
    errorTitle:'Kategori tidak valid',
    error:'Pilih B2B, B2B Grosir, atau B2C.',
    formulae:['"'+CATEGORIES.join(',')+'"']
  });
  ws.printTitlesRow='1:5';
  ws.headerFooter.oddFooter='PixelApps • Klasifikasi Customer — Halaman &P dari &N';

  const guide=wb.addWorksheet('Panduan',{properties:{defaultRowHeight:23}});
  guide.columns=[{width:7},{width:34},{width:62}];
  guide.mergeCells('A1:C1');
  guide.getCell('A1').value='PANDUAN KLASIFIKASI CUSTOMER';
  guide.getCell('A1').font={bold:true,size:17,color:{argb:'FFFFFFFF'}};
  guide.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF18283F'}};
  guide.getRow(1).height=37;
  const tips=[
    ['1','Buka sheet Klasifikasi Customer','Berisi semua customer CRM yang tersedia saat export.'],
    ['2','Periksa data customer','Gunakan nama, nomor WA, Sales PIC, dan segmentasi lama sebagai referensi.'],
    ['3','Isi kolom J','Pilih tepat satu kategori: B2B, B2B Grosir, atau B2C.'],
    ['4','Jangan ubah Customer ID','ID dipakai sebagai identitas unik jika klasifikasi ditindaklanjuti.'],
    ['5','Simpan hasil klasifikasi','File Excel ini hanya untuk review offline dan TIDAK otomatis memperbarui data CRM.']
  ];
  tips.forEach((r,i)=>{const row=guide.addRow(r);row.height=38;row.eachCell(c=>{c.alignment={vertical:'middle',wrapText:true};c.font={size:11,color:{argb:'FF263449'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:i%2?'FFF5F7FA':'FFFFFFFF'}}})});
  guide.getCell('B8').value='Pilihan klasifikasi';
  guide.getCell('C8').value=CATEGORIES.join('  •  ');
  guide.getCell('C8').font={bold:true,color:{argb:'FFE4752D'}};
  return wb;
}

async function exportCustomers(req,res){
  const user=req.session?.user;
  if(!user)return res.status(401).json({error:'Unauthorized'});
  if(!allowed(user))return res.status(403).json({error:'Anda tidak memiliki izin export klasifikasi customer.'});
  try{
    const customers=await require('./db').getCrmCustomers();
    if(!Array.isArray(customers))throw new Error('Data customer tidak valid.');
    const workbook=buildWorkbook(customers);
    const buffer=await workbook.xlsx.writeBuffer();
    const stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="PixelApps_Klasifikasi_Customer_'+stamp+'.xlsx"');
    res.setHeader('Cache-Control','private, no-store, max-age=0');
    return res.send(Buffer.from(buffer));
  }catch(error){
    console.error('[PXL-CRM-0001] export failed',error);
    return res.status(500).json({error:'Gagal mengekspor customer CRM.'});
  }
}
if(!express.application[KEY]){
  express.application[KEY]=true;
  express.application.get=function pxlCrm0001Get(route,...handlers){
    if(route==='/api/crm/report'&&!this.__pxlCrm0001ExportReady){
      this.__pxlCrm0001ExportReady=true;
      const readAuth=handlers.slice(0,-1);
      oldGet.call(this,'/api/crm/customers/export-classification',...readAuth,exportCustomers);
    }
    return oldGet.call(this,route,...handlers);
  };
}
module.exports={allowed,buildWorkbook,exportCustomers,CATEGORIES};
