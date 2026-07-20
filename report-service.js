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
  doc.font('Helvetica').text('Bank Info:',38,ry+52).text('Account Bank Name Bank BRI Denpasar',38,ry+67).text('Account Number - 0 0 1 7 0 1 0 0 4 5 4 7 3 0 2',38,ry+82).text('Owner Account Bali Teknik Utama',38,ry+97);
  const sx=390,sy=ry+10;[['TOTAL',total],['DOWN PAYMENT',dp],['REDEMPTION',red],['BALANCE DUE',balance]].forEach((a,i)=>{doc.font(i===3?'Helvetica-Bold':'Helvetica').text(a[0],sx,sy+i*18,{width:94}).text('IDR',474,sy+i*18,{width:28}).text(a[1]?fmt(a[1]):'-',505,sy+i*18,{width:55,align:'right'});});doc.rect(sx,sy+71,170,4).fill(orange);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(navy).text('THANK YOU FOR YOUR BUSINESS!',85,ry+142);
  if(fs.existsSync(sign))doc.image(sign,390,ry+92,{width:170});else doc.fontSize(10).fillColor('#111').text('Pixel Solusindo\n\nI Putu Eka Hendrayana',410,ry+105,{align:'center'});
  doc.end();
}
module.exports={writeExcel,writePdf,invoicePdf};
