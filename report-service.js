const PDFDocument=require('pdfkit');
const ExcelJS=require('exceljs');
const path=require('path');
const fs=require('fs');

const fmt=n=>Number(n||0).toLocaleString('id-ID');
function safe(v){if(v==null)return'';if(Array.isArray(v))return v.map(x=>typeof x==='object'?JSON.stringify(x):x).join('; ');if(typeof v==='object')return JSON.stringify(v);return String(v)}
function flattenRows(rows){
  rows=Array.isArray(rows)?rows:[];
  const keys=[]; rows.forEach(r=>Object.keys(r||{}).forEach(k=>{if(!keys.includes(k)&&!['password','signature_data'].includes(k))keys.push(k)}));
  return {columns:keys,rows:rows.map(r=>keys.map(k=>safe(r?.[k])))};
}
async function writeExcel(res,title,rows){
  const {columns,rows:data}=flattenRows(rows); const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(title.slice(0,31)||'Report');
  ws.mergeCells('A1:'+String.fromCharCode(64+Math.max(1,Math.min(columns.length,26)))+'1');
  ws.getCell('A1').value='PIXEL SOLUSINDO - '+title.toUpperCase(); ws.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFFFF'}};ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B2E65'}};ws.getCell('A1').alignment={horizontal:'center'};
  ws.addRow([]); ws.addRow(columns.length?columns:['Keterangan']);
  const hr=ws.getRow(3);hr.font={bold:true,color:{argb:'FFFFFFFF'}};hr.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE07B39'}};
  data.forEach(r=>ws.addRow(r)); ws.views=[{state:'frozen',ySplit:3}];
  ws.columns.forEach(c=>{c.width=Math.min(40,Math.max(12,...c.values.map(v=>String(v||'').length+2)));});
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',`attachment; filename="${title.replace(/[^a-z0-9]/gi,'-')}.xlsx"`);
  await wb.xlsx.write(res); res.end();
}
function writePdf(res,title,rows){
  const {columns,rows:data}=flattenRows(rows); const doc=new PDFDocument({size:'A4',layout:columns.length>7?'landscape':'portrait',margin:28});
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${title.replace(/[^a-z0-9]/gi,'-')}.pdf"`);doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0B2E65').text('PIXEL SOLUSINDO');doc.fontSize(18).fillColor('#111').text(title,{align:'right'});doc.moveDown();
  const useCols=columns.slice(0,10); const pageW=doc.page.width-doc.page.margins.left-doc.page.margins.right; const cw=pageW/Math.max(1,useCols.length); let y=doc.y;
  doc.rect(doc.page.margins.left,y,pageW,22).fill('#0B2E65');doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold');useCols.forEach((c,i)=>doc.text(c,doc.page.margins.left+i*cw+3,y+7,{width:cw-6,ellipsis:true}));y+=22;
  doc.font('Helvetica').fontSize(7).fillColor('#222');data.forEach(row=>{if(y>doc.page.height-55){doc.addPage();y=doc.page.margins.top;} const h=24;doc.rect(doc.page.margins.left,y,pageW,h).strokeColor('#ddd').stroke();useCols.forEach((c,i)=>doc.text(String(row[columns.indexOf(c)]||''),doc.page.margins.left+i*cw+3,y+5,{width:cw-6,height:h-8,ellipsis:true}));y+=h;});
  doc.end();
}
function invoicePdf(res,inv){
  const doc=new PDFDocument({size:'A4',margin:28});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`inline; filename="${inv.invoice_number||'invoice'}.pdf"`);doc.pipe(res);
  const navy='#082B63', orange='#DF8736'; const left=28,right=567;
  const logo=path.join(__dirname,'public/assets/invoice-logo.png'), sign=path.join(__dirname,'public/assets/invoice-signature.png');
  if(fs.existsSync(logo))doc.image(logo,55,40,{width:72});
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#000').text('PIXEL SOLUSINDO',145,64);doc.fontSize(30).text('INVOICE',405,55,{width:150,align:'center'});
  doc.rect(left,118,360,4).fill(navy);doc.rect(388,118,179,4).fill(orange);
  doc.font('Helvetica').fontSize(10).fillColor('#111').text('Invoice To:',30,137).text(inv.customer_name||inv.customer||'-',30,152);
  doc.text('Invoice No.',390,142).fontSize(8).text(inv.invoice_number||inv.original_name||'-',452,143,{width:113,align:'right',lineBreak:false}).fontSize(10).text('Date',390,162).text(new Date(inv.uploaded_at||inv.created_at||Date.now()).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}),455,162,{width:110,align:'right'}).text('Remark',390,178).text(inv.remark||'...............................',455,178,{width:110,align:'right'});
  doc.font('Helvetica-Bold').fontSize(13).text(inv.title||inv.project_name||'Invoice Pekerjaan',30,210,{width:537,align:'center'});
  const items=(inv.items&&inv.items.length?inv.items:[{description:inv.description||inv.original_name||'Invoice',qty:1,unit:'Paket',unit_price:Number(inv.total_amount||inv.grand_total||0)}]).map(x=>({...x,total:Number(x.total||x.qty*x.unit_price||0)}));
  const x=[28,54,330,365,410,488,567], y=235, hh=23;doc.rect(x[0],y,x[6]-x[0],hh).fill(navy);doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);['NO','ITEM DESCRIPTION','QTY','UNIT','PRICE','TOTAL'].forEach((t,i)=>doc.text(t,x[i]+3,y+7,{width:x[i+1]-x[i]-6,align:i===1?'center':'center'}));
  let ry=y+hh;doc.fillColor('#222').font('Helvetica').fontSize(8);items.forEach((it,i)=>{doc.rect(x[0],ry,x[6]-x[0],20).strokeColor('#d5d5d5').stroke();const vals=[i+1,it.description||it.name||'-',it.qty||1,it.unit||it.satuan||'Paket','IDR '+fmt(it.unit_price),'IDR '+fmt(it.total)];vals.forEach((v,j)=>doc.text(String(v),x[j]+3,ry+6,{width:x[j+1]-x[j]-6,align:j>=2?'right':'left'}));ry+=20;});
  const total=Number(inv.grand_total||inv.total_amount||items.reduce((s,x)=>s+x.total,0)),dp=Number(inv.down_payment||0),red=Number(inv.redemption||0),balance=total-dp-red;
  doc.fontSize(10).fillColor('#111').text('PAYMENT METHOD',30,ry+10).font('Helvetica-Bold').text(inv.payment_method||'CASH & TRANSFER BANK',30,ry+25);
  doc.font('Helvetica').text('Bank Info:',38,ry+52).text('BCA',38,ry+67).text('Account Number - 6116016306',38,ry+82).text('Owner Account - CV. Cipta Kreasitama',38,ry+97);
  const sx=390,sy=ry+10;[['TOTAL',total],['DOWN PAYMENT',dp],['REDEMPTION',red],['BALANCE DUE',balance]].forEach((a,i)=>{doc.font(i===3?'Helvetica-Bold':'Helvetica').text(a[0],sx,sy+i*18,{width:94}).text('IDR',474,sy+i*18,{width:28}).text(a[1]?fmt(a[1]):'-',505,sy+i*18,{width:55,align:'right'});});doc.rect(sx,sy+71,170,4).fill(orange);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(navy).text('THANK YOU FOR YOUR BUSINESS!',85,ry+142);
  if(fs.existsSync(sign))doc.image(sign,390,ry+92,{width:170});else doc.fontSize(10).fillColor('#111').text('Pixel Solusindo\n\nI Putu Eka Hendrayana',410,ry+105,{align:'center'});
  doc.end();
}

function dataUrlBuffer(v){
  try{
    const str=String(v||'');
    const m=str.match(/^data:image\/(?:png|jpeg|jpg);base64,(.+)$/i);
    return m?Buffer.from(m[1],'base64'):null;
  }catch(_){return null;}
}
function serviceReceiptPdf(res,row,type='intake'){
  const isHandover=type==='handover';
  const title=isHandover?'BUKTI SERAH TERIMA KEMBALI':'TANDA TERIMA SERVICE';
  const customerName=isHandover?(row.handover_customer_name||row.customer_name):(row.intake_customer_name||row.customer_name);
  const customerSig=isHandover?row.handover_customer_signature:row.intake_customer_signature;
  const pixelName=isHandover?(row.handover_pixel_name||'-'):(row.intake_pixel_name||row.created_by||'-');
  const pixelSig=isHandover?row.handover_pixel_signature:row.intake_pixel_signature;
  const signedAt=isHandover?row.handover_signed_at:row.intake_signed_at;
  if(!customerSig||!pixelSig){res.status(409).json({error:'Tanda tangan belum lengkap.'});return;}
  const doc=new PDFDocument({size:'A4',margin:34});
  const safeNo=String(row.service_number||'service').replace(/[^a-z0-9_-]/gi,'-');
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','inline; filename="'+safeNo+'-'+(isHandover?'pengembalian':'penerimaan')+'.pdf"');
  doc.pipe(res);
  const navy='#0B2E65',orange='#E07B39',muted='#6B7280';
  doc.rect(0,0,595,18).fill(orange);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(navy).text('PIXEL SOLUSINDO',34,34);
  doc.fontSize(15).fillColor('#111').text(title,34,58,{align:'right'});
  doc.moveTo(34,82).lineTo(561,82).strokeColor('#D1D5DB').stroke();
  const fmtDate=v=>v?new Date(v).toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-';
  const rows=[
    ['No. Service',row.service_number||'-'],['Tanggal Masuk',fmtDate(row.received_at)],['Customer Utama',row.customer_name||'-'],['No. WhatsApp',row.customer_phone||'-'],
    ['Perangkat',[row.device_type,row.brand,row.model].filter(Boolean).join(' ')||'-'],['Serial Number',row.serial_number||'-'],['Keluhan',row.complaint||'-'],
    ['Kondisi Awal',row.initial_condition||'-'],['Kelengkapan',Array.isArray(row.accessories)?row.accessories.join(', '):(row.accessories||'-')],['Estimasi Selesai',row.estimated_done_date||'-'],['Teknisi In Charge',row.technician_name||'-']
  ];
  let y=96;
  doc.fontSize(9);
  rows.forEach(([k,v])=>{
    const val=String(v||'-');
    const h=Math.max(18,doc.heightOfString(val,{width:350})+8);
    doc.font('Helvetica-Bold').fillColor(muted).text(k,38,y+5,{width:135});
    doc.font('Helvetica').fillColor('#111').text(val,178,y+5,{width:350});
    doc.moveTo(38,y+h).lineTo(557,y+h).strokeColor('#ECECEC').stroke();
    y+=h;
  });
  y+=12;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(navy).text(isHandover?'SERAH TERIMA KEMBALI':'PENERIMAAN BARANG',38,y);
  y+=16;
  doc.font('Helvetica').fontSize(8.5).fillColor(muted).text('Ditandatangani: '+fmtDate(signedAt),38,y);
  y+=18;
  const colW=245,left=38,right=312,boxH=100;
  doc.roundedRect(left,y,colW,boxH,5,5).strokeColor('#D1D5DB').stroke();
  doc.roundedRect(right,y,colW,boxH,5,5).strokeColor('#D1D5DB').stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(isHandover?'Penerima Barang':'Penyerah / Customer',left+10,y+9,{width:colW-20,align:'center'});
  doc.text(isHandover?'Petugas Pixel Menyerahkan':'Penerima Pixel',right+10,y+9,{width:colW-20,align:'center'});
  const cb=dataUrlBuffer(customerSig),pb=dataUrlBuffer(pixelSig);
  if(cb) try{doc.image(cb,left+50,y+26,{fit:[145,42],align:'center',valign:'center'});}catch(_){}
  if(pb) try{doc.image(pb,right+50,y+26,{fit:[145,42],align:'center',valign:'center'});}catch(_){}
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111').text(customerName||'-',left+10,y+75,{width:colW-20,align:'center'});
  doc.text(pixelName||'-',right+10,y+75,{width:colW-20,align:'center'});
  y+=boxH+16;
  doc.font('Helvetica').fontSize(8).fillColor(muted).text('Tracking service tersedia melalui link yang diberikan Pixel Solusindo. Dokumen ini dibuat secara elektronik dari PixelApps.',38,y,{width:519,align:'center'});
  doc.end();
}

module.exports={writeExcel,writePdf,invoicePdf,serviceReceiptPdf};
