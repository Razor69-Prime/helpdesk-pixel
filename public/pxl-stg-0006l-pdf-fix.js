/* PXL-STG-0006L + PXL-PROD-0022PDF5 — generator PDF WO aktif dengan TTD BAST. */
(function(){
  'use strict';
  const ORANGE=[231,126,50];
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const safe=v=>String(v||'data').replace(/[^a-zA-Z0-9_-]/g,'_');
  const authHeaders=()=>{let token='';try{token=localStorage.getItem('pixel_token')||'';}catch(_){}return token?{Authorization:'Bearer '+token}:{}};
  async function json(url){const r=await fetch(url,{headers:authHeaders(),cache:'no-store'});let d={};try{d=await r.json();}catch(_){}if(!r.ok)throw new Error(d.error||'Gagal mengambil data.');return d;}
  async function ensurePdf(){if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s);});return window.jspdf.jsPDF;}
  function ticketById(id){try{return (Array.isArray(allTickets)?allTickets:[]).find(t=>String(t.id)===String(id)||String(t.wo_number)===String(id))||null;}catch(_){return null;}}
  async function trackingDetail(t){if(!t?.tracking_token)return t||{};try{return {...t,...await json('/api/track/'+encodeURIComponent(t.tracking_token))};}catch(e){console.warn('[PXL-PROD-0022PDF5] tracking detail gagal',e);return t||{};}}
  async function signaturePng(value){
    if(!value)return null;
    const raw=String(value).trim();
    let src=raw;
    if(!/^data:image\//i.test(raw)){
      try{const r=await fetch(raw,{cache:'no-store'});if(!r.ok)return null;const b=await r.blob();src=await new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=()=>ok(null);fr.readAsDataURL(b);});}catch(_){return null;}
    }
    if(!src)return null;
    return await new Promise(ok=>{const img=new Image();img.onload=()=>{try{const w=Math.max(1,img.naturalWidth||img.width||800),h=Math.max(1,img.naturalHeight||img.height||300);const c=document.createElement('canvas');c.width=Math.min(1200,w);c.height=Math.max(1,Math.round(h*(c.width/w)));const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);ok(c.toDataURL('image/png'));}catch(_){ok(null);}};img.onerror=()=>ok(null);img.src=src;});
  }
  function addSig(doc,data,x,y,w,h,label){if(!data)return false;try{doc.addImage(data,'PNG',x,y,w,h,undefined,'FAST');return true;}catch(e){console.warn('[PXL-PROD-0022PDF5] add signature gagal',label,e);return false;}}
  function servicesFromTicket(t){const direct=Array.isArray(t?.service_items)?t.service_items:[];if(direct.length)return direct;const text=String(t?.description||'');const marker='DAFTAR PEKERJAAN / JASA';const part=text.includes(marker)?text.split(marker)[1]:'';return part.split('\n').map(x=>x.trim()).filter(x=>/^\d+\./.test(x)).map(line=>{const raw=line.replace(/^\d+\.\s*/,'');const m=raw.match(/^(.*?)\s+[—-]\s+([\d.,]+)\s+(.+)$/);return m?{name:m[1],qty:Number(String(m[2]).replace(',','.'))||1,unit:m[3]}:{name:raw,qty:1,unit:'jasa'};});}
  function parseDescription(t,label){const text=String(t?.description||'');const re=new RegExp(label+'\\s*:\\s*([^\\n]+)','i');return text.match(re)?.[1]?.trim()||'-';}
  async function exportWo(ticketId){
    try{
      const [JsPDF,data]=await Promise.all([ensurePdf(),json('/api/material-requests-form/work-order/'+encodeURIComponent(ticketId)+'/items')]);
      const base=ticketById(ticketId)||{};const t=await trackingDetail(base);const material=Array.isArray(data.items)?data.items:[];const service=servicesFromTicket(t);
      const [techSig,custSig]=await Promise.all([signaturePng(t.tech_signature),signaturePng(t.customer_signature)]);
      const doc=new JsPDF({unit:'mm',format:'a4'}),PW=210,ML=14,MR=14,CW=182;
      const today=new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
      doc.setFillColor(...ORANGE);doc.rect(0,0,PW,18,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('PIXEL SOLUSINDO',ML,9);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Laporan Pekerjaan Teknisi',ML,13.5);doc.text('Dicetak: '+today,PW-MR,9,{align:'right'});doc.text('0877-3477-2999',PW-MR,13.5,{align:'right'});
      let y=29;doc.setFillColor(248,247,244);doc.roundedRect(ML,y,CW,18,3,3,'F');doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(String(t.wo_number||data.wo_number||'-'),ML+6,y+11);doc.setFillColor(67,49,154);doc.roundedRect(PW-MR-32,y+4,32,10,2,2,'F');doc.setTextColor(255);doc.setFontSize(7);doc.text(String(t.status||'Assigned'),PW-MR-16,y+10.5,{align:'center'});
      y+=23;const info=[['TEKNISI',t.technician||t.technician_1||'-'],['NAMA PROJECT',t.project_name||t.project||'-'],['NAMA CUSTOMER',t.customer_name||t.customer||'-'],['NO. WA CUSTOMER',t.customer_phone||'-'],['TANGGAL KERJA',today],['DIBUAT',today]];info.forEach((v,i)=>{const col=i%2,row=Math.floor(i/2),x=ML+col*94,yy=y+row*18;doc.setFillColor(249,249,247);doc.roundedRect(x,yy,86,14,2,2,'F');doc.setTextColor(110);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text(v[0],x+4,yy+4);doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(doc.splitTextToSize(String(v[1]),78),x+4,yy+9);});
      y+=58;doc.setTextColor(25);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('DESKRIPSI PEKERJAAN',ML,y);doc.setDrawColor(...ORANGE);doc.line(ML,y+3,PW-MR,y+3);y+=9;
      const lines=['Dibuat otomatis dari: '+(t.so_number||'-'),'Lokasi pekerjaan: '+(t.address||t.location||parseDescription(t,'Lokasi pekerjaan')),'Remarks: '+(t.remarks||t.remark||parseDescription(t,'Remarks')),'Item:'];material.forEach((it,i)=>lines.push(`${i+1}. ${it.name||it.item_name||'-'} — ${n(it.qty_out??it.qty)} ${it.unit||'pcs'}`));if(!material.length)lines.push('-');lines.push('','Daftar Pekerjaan / Jasa:');service.forEach((it,i)=>lines.push(`${i+1}. ${it.name||it.item_name||'-'} — ${n(it.qty)} ${it.unit||'jasa'}`));if(!service.length)lines.push('-');
      const wrapped=[];lines.forEach(line=>line===''?wrapped.push(''):wrapped.push(...doc.splitTextToSize(line,CW-10)));const boxH=Math.max(35,wrapped.length*4+10);if(y+boxH>245){doc.addPage();y=20;}doc.setFillColor(250,249,247);doc.setDrawColor(215);doc.roundedRect(ML,y,CW,boxH,2,2,'FD');doc.setTextColor(35);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(wrapped,ML+5,y+7,{lineHeightFactor:1.35});y+=boxH+10;if(y>235){doc.addPage();y=22;}
      doc.setDrawColor(195);doc.rect(ML,y,86,38);doc.rect(PW-MR-86,y,86,38);doc.setTextColor(115);doc.setFontSize(6.5);doc.text('Teknisi Pelaksana',ML+4,y+6);doc.text('Customer / Penerima',PW-MR-82,y+6);
      const techOk=addSig(doc,techSig,ML+16,y+8,54,17,'teknisi');const custOk=addSig(doc,custSig,PW-MR-70,y+8,54,17,'customer');
      if(t.tech_signature&&!techOk)console.warn('[PXL-PROD-0022PDF5] tech_signature tersedia tetapi tidak tergambar');if(t.customer_signature&&!custOk)console.warn('[PXL-PROD-0022PDF5] customer_signature tersedia tetapi tidak tergambar');
      doc.setTextColor(35);doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(String(t.technician||t.technician_1||'-'),ML+4,y+30);doc.text(String(t.customer_name||'-'),PW-MR-82,y+30);
      const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFillColor(...ORANGE);doc.rect(0,286,PW,8,'F');doc.setTextColor(255);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text(`WO: ${t.wo_number||data.wo_number||'-'} | Pixel Solusindo | 0877-3477-2999 | Hal ${p}/${pages}`,PW/2,291,{align:'center'});}doc.save(`laporan_${safe(t.wo_number||data.wo_number||'WO')}_${new Date().toISOString().slice(0,10)}.pdf`);
    }catch(e){alert(e.message||'Gagal membuat PDF WO.');}
  }
  function salesOrderId(button){const direct=button.dataset.id||button.getAttribute('data-id');if(direct)return direct;const onclick=button.getAttribute('onclick')||'';return onclick.match(/["']([^"']+)["']/)?.[1]||'';}
  document.addEventListener('click',function(e){const b=e.target?.closest?.('button');if(!b)return;const label=String(b.textContent||'').trim().toLowerCase();if(label==='pdf penawaran'){const id=salesOrderId(b);if(id&&typeof window.downloadQuotationPDF==='function'){e.preventDefault();e.stopImmediatePropagation();window.downloadQuotationPDF(id);}}},true);
  // 0006L dimuat paling akhir: jadikan generator ini authoritative supaya TTD pasti ikut dirender.
  window.exportTicketPDF=exportWo;
})();