/* PXL-STG-0006K — perapian PDF WO, aksi kartu teknisi PWA, dan PDF Penawaran customer. */
(function(){
  'use strict';

  const NAVY=[18,49,88], ORANGE=[231,126,50], PEACH=[252,232,218];
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const idr=v=>Math.round(n(v)).toLocaleString('id-ID');
  const safe=v=>String(v||'data').replace(/[^a-zA-Z0-9_-]/g,'_');
  const dateId=v=>{
    if(!v)return '-';
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return String(v);
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  };
  const authHeaders=()=>{
    let token='';
    try{token=localStorage.getItem('pixel_token')||'';}catch(_){}
    return token?{Authorization:'Bearer '+token}:{};
  };
  async function json(url){
    const r=await fetch(url,{headers:authHeaders(),cache:'no-store'});
    let data={};try{data=await r.json();}catch(_){}
    if(!r.ok)throw new Error(data.error||'Gagal mengambil data.');
    return data;
  }
  async function ensureJsPDF(){
    if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload=resolve;s.onerror=()=>reject(new Error('Library PDF gagal dimuat.'));
      document.head.appendChild(s);
    });
    return window.jspdf.jsPDF;
  }
  async function imageData(url){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)return null;
      const blob=await response.blob();
      return await new Promise(resolve=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result);
        reader.onerror=()=>resolve(null);
        reader.readAsDataURL(blob);
      });
    }catch(_){
      return null;
    }
  }
  function addPdfImage(doc,data,x,y,w,h){
    if(!data)return false;
    try{
      const format=/^data:image\/(?:jpe?g)/i.test(String(data))?'JPEG':'PNG';
      doc.addImage(data,format,x,y,w,h);
      return true;
    }catch(_){return false;}
  }

  async function getTickets(){
    const tries=['/api/tickets?include_archived=true','/api/tickets','/tickets'];
    for(const url of tries){
      try{
        const data=await json(url);
        const rows=Array.isArray(data)?data:(data.tickets||data.data||[]);
        if(Array.isArray(rows))return rows;
      }catch(_){}
    }
    return [];
  }
  async function getSalesOrders(){
    const report=await json('/api/crm/report');
    return Array.isArray(report.sales_orders)?report.sales_orders:[];
  }
  function splitSOItems(so){
    const items=Array.isArray(so?.items)?so.items:[];
    return {
      material:items.filter(i=>!['service','jasa'].includes(String(i.item_type||i.type||'item').toLowerCase())),
      service:items.filter(i=>['service','jasa'].includes(String(i.item_type||i.type||'').toLowerCase()))
    };
  }
  function addPwaCss(){
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
    if(!standalone||document.getElementById('pxl-0006k-pwa-css'))return;
    const style=document.createElement('style');
    style.id='pxl-0006k-pwa-css';
    style.textContent=`
      @media(max-width:600px){
        .ticket-item{padding:10px!important;overflow:hidden}
        .ticket-header{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important}
        .ticket-header>div:first-child{min-width:0!important;width:100%!important}
        .ticket-tech,.ticket-project,.ticket-wo{overflow-wrap:anywhere!important;word-break:break-word!important}
        .ticket-actions{width:100%!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;justify-content:stretch!important;align-items:stretch!important;margin-top:3px!important}
        .ticket-actions .btn,.ticket-actions select,.ticket-actions button{min-width:0!important;width:100%!important;padding:6px 4px!important;font-size:10px!important;line-height:1.15!important;justify-content:center!important;white-space:normal!important;text-align:center!important}
        .ticket-actions .status-select{grid-column:1/-1!important}
      }
      @media(max-width:390px){.ticket-actions{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
    `;
    document.head.appendChild(style);
  }

  async function exportWoPdf(ticketId){
    try{
      const [JsPDF,tickets,salesOrders]=await Promise.all([ensureJsPDF(),getTickets(),getSalesOrders().catch(()=>[])]);
      const t=tickets.find(x=>String(x.id)===String(ticketId)||String(x.wo_number)===String(ticketId));
      if(!t)throw new Error('Work Order tidak ditemukan.');
      const so=salesOrders.find(s=>String(s.id)===String(t.sales_order_id)||String(s.linked_work_order_id)===String(t.id)||String(s.linked_wo_number)===String(t.wo_number));
      const {material,service}=splitSOItems(so);
      const [techSignature,customerSignature]=await Promise.all([
        t.tech_signature?imageData(t.tech_signature):Promise.resolve(null),
        t.customer_signature?imageData(t.customer_signature):Promise.resolve(null)
      ]);
      const doc=new JsPDF({unit:'mm',format:'a4'}), PW=210,PH=297,ML=14,MR=14,CW=182;
      const today=new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
      doc.setFillColor(...ORANGE);doc.rect(0,0,PW,18,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('PIXEL SOLUSINDO',ML,9);
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Laporan Pekerjaan Teknisi',ML,13.5);doc.text('Dicetak: '+today,PW-MR,9,{align:'right'});doc.text('0877-3477-2999',PW-MR,13.5,{align:'right'});
      let y=29;
      doc.setFillColor(248,247,244);doc.roundedRect(ML,y,CW,18,3,3,'F');
      doc.setTextColor(25,25,25);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(String(t.wo_number||'-'),ML+6,y+11);
      doc.setFillColor(67,49,154);doc.roundedRect(PW-MR-32,y+4,32,10,2,2,'F');doc.setTextColor(255,255,255);doc.setFontSize(7);doc.text(String(t.status||'Assigned'),PW-MR-16,y+10.5,{align:'center'});
      y+=23;
      const info=[['TEKNISI',t.technician||t.technician_1||'-'],['NAMA PROJECT',t.project_name||t.project||so?.project_name||'-'],['NAMA CUSTOMER',t.customer_name||t.customer||so?.customer_name||'-'],['NO. WA CUSTOMER',t.customer_phone||so?.customer_phone||'-'],['TANGGAL KERJA',dateId(t.schedule_date||t.work_date||t.created_at)],['DIBUAT',dateId(t.created_at)]];
      info.forEach((v,i)=>{const col=i%2,row=Math.floor(i/2),x=ML+col*94,yy=y+row*18;doc.setFillColor(249,249,247);doc.roundedRect(x,yy,86,14,2,2,'F');doc.setTextColor(110);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text(v[0],x+4,yy+4);doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(doc.splitTextToSize(String(v[1]),78),x+4,yy+9);});
      y+=58;
      doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('DESKRIPSI PEKERJAAN',ML,y);doc.setDrawColor(...ORANGE);doc.line(ML,y+3,PW-MR,y+3);y+=9;
      const remarks=so?.notes||t.remarks||t.remark||'-';
      const location=so?.address||so?.location||t.address||t.location||'-';
      const lines=[
        'Dibuat otomatis dari: '+(so?.so_number||t.so_number||'-'),
        'Lokasi pekerjaan: '+location,
        'Remarks: '+remarks,
        'Item:'
      ];
      material.forEach((it,i)=>lines.push(`${i+1}. ${it.name||it.item_name||'-'} — ${n(it.qty)} ${it.unit||'pcs'}`));
      if(!material.length)lines.push('-');
      lines.push('','Daftar Pekerjaan / Jasa:');
      service.forEach((it,i)=>lines.push(`${i+1}. ${it.name||it.item_name||'-'} — ${n(it.qty)} ${it.unit||'jasa'}`));
      if(!service.length)lines.push('-');
      const wrapped=[];lines.forEach(line=>{if(line==='')wrapped.push('');else wrapped.push(...doc.splitTextToSize(line,CW-10));});
      const boxH=Math.max(35,wrapped.length*4+10);
      if(y+boxH>245){doc.addPage();y=20;}
      doc.setFillColor(250,249,247);doc.setDrawColor(215);doc.roundedRect(ML,y,CW,boxH,2,2,'FD');doc.setTextColor(35);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(wrapped,ML+5,y+7,{lineHeightFactor:1.35});
      y+=boxH+10;
      if(y>235){doc.addPage();y=22;}
      doc.setDrawColor(195);doc.rect(ML,y,86,38);doc.rect(PW-MR-86,y,86,38);
      doc.setTextColor(115);doc.setFontSize(6.5);doc.text('Teknisi Pelaksana',ML+4,y+6);doc.text('Customer / Penerima',PW-MR-82,y+6);
      addPdfImage(doc,techSignature,ML+20,y+9,46,15);
      addPdfImage(doc,customerSignature,PW-MR-66,y+9,46,15);
      doc.setTextColor(35);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(String(t.technician||t.technician_1||'-'),ML+4,y+30);doc.text(String(t.customer_name||so?.customer_name||'-'),PW-MR-82,y+30);
      const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFillColor(...ORANGE);doc.rect(0,286,PW,8,'F');doc.setTextColor(255);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text(`WO: ${t.wo_number||'-'} | Pixel Solusindo | 0877-3477-2999 | Hal ${p}/${pages}`,PW/2,291,{align:'center'});}
      doc.save(`laporan_${safe(t.wo_number||'WO')}_${new Date().toISOString().slice(0,10)}.pdf`);
    }catch(e){alert(e.message||'Gagal membuat PDF WO.');}
  }

  async function exportQuotationPdf(id){
    try{
      const [JsPDF,orders,logo]=await Promise.all([
        ensureJsPDF(),
        getSalesOrders(),
        imageData('/pixel-solusindo-logo.png?v=PXL-PROD-0021A')
      ]);
      const so=orders.find(x=>String(x.id)===String(id));if(!so)throw new Error('Sales Order tidak ditemukan.');
      const {material,service}=splitSOItems(so);const doc=new JsPDF({unit:'mm',format:'a4'});
      doc.setFillColor(255,255,255);doc.rect(10,10,190,29,'F');
      if(logo){
        try{doc.addImage(logo,'PNG',14,15,58,18);}catch(_){}
      }
      doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(25);doc.text('QUOTATION',196,28,{align:'right'});
      doc.setFillColor(...NAVY);doc.rect(10,39,126,1.4,'F');doc.setFillColor(...ORANGE);doc.rect(136,39,64,1.4,'F');
      doc.setFontSize(8);doc.text('Customer:',10,50);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(doc.splitTextToSize([so.customer_name,so.address||so.location,so.customer_phone].filter(Boolean).join('\n'),90),10,57);
      const details=[['Quotation No.',so.quotation_number||'-'],['SO No.',so.so_number||'-'],['Date',dateId(so.quotation_date||so.created_at)],['Expired',dateId(so.quotation_valid_until||so.valid_until)]];
      details.forEach((d,i)=>{const yy=51+i*5.5;doc.setFontSize(8.5);doc.text(d[0],137,yy);doc.text(String(d[1]),199,yy,{align:'right'});});
      let y=92;doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(String(so.quotation_title||so.project_name||'Penawaran'),105,y,{align:'center'});y+=14;
      function section(title,rows){doc.setFontSize(9);doc.text(title,10,y);y+=3;doc.setFillColor(...NAVY);doc.rect(10,y,190,1.1,'F');y+=7;doc.setFontSize(8);['NO','DESCRIPTION','QTY','UNIT','PRICE','TOTAL'].forEach((h,i)=>doc.text(h,[16,65,119,137,158,184][i],y,{align:i===1?'center':'left'}));y+=5;doc.setFont('helvetica','normal');rows.forEach((r,i)=>{const desc=doc.splitTextToSize(String(r.name||r.item_name||'-'),82),h=Math.max(7,desc.length*4+2);if(y+h>270){doc.addPage();y=20;}doc.setDrawColor(225);doc.line(10,y+h,200,y+h);doc.text(String(i+1),16,y+4);doc.text(desc,23,y+4);doc.text(String(n(r.qty)),116,y+4);doc.text(String(r.unit||'-'),135,y+4);doc.text('IDR '+idr(r.unit_price),151,y+4);doc.text('IDR '+idr(n(r.qty)*n(r.unit_price)),179,y+4);y+=h;});y+=8;doc.setFont('helvetica','bold');}
      section('A. ITEM DETAILS',material);section('B. SERVICE DETAILS',service);
      if(y>245){doc.addPage();y=25;}doc.setFillColor(...NAVY);doc.rect(10,y,190,1.2,'F');y+=11;doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('Jika ada pertanyaan mengenai penawaran ini, silakan hubungi:',10,y);doc.text('Marketing Pixel Solusindo (+62 877-3477-2999)',10,y+7);
      const m=n(so.material_subtotal??material.reduce((s,r)=>s+n(r.qty)*n(r.unit_price),0)),s=n(so.service_subtotal??service.reduce((a,r)=>a+n(r.qty)*n(r.unit_price),0)),g=n(so.quotation_total??so.total_amount??m+s);
      [['ITEM PRICES',m],['SERVICE PRICES',s]].forEach((r,i)=>{const yy=y+i*7;doc.text(r[0],137,yy);doc.text('IDR',169,yy);doc.text(idr(r[1]),181,yy);});const gy=y+20;doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('GRAND TOTAL',137,gy);doc.text('IDR',169,gy);doc.text(idr(g),181,gy);doc.setFillColor(...ORANGE);doc.rect(137,gy+3,63,1.7,'F');
      const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(125);doc.text(`${so.quotation_number||'-'} | ${so.so_number||'-'} | Hal ${p}/${pages}`,105,293,{align:'center'});}
      doc.save(`Quotation_${safe(so.quotation_number)}_${safe(so.so_number)}.pdf`);
    }catch(e){if(typeof toast==='function')toast(e.message);else alert(e.message||'Gagal membuat PDF Penawaran.');}
  }

  addPwaCss();
  window.addEventListener('load',addPwaCss);
  window.exportTicketPDF=function(ticketId){return exportWoPdf(ticketId);};
  window.downloadQuotationPDF=function(id){return exportQuotationPdf(id);};
})();