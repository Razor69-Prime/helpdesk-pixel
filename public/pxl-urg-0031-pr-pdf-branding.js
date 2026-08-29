/* PXL-URG-0031D — fast PR PDF renderer with classic layout. Numbering/calculation logic unchanged. */
(function(){
  'use strict';
  const REV='PXL-URG-0031D';
  const LOGO='/pixel-solusindo-logo.png';
  let logoData=null;

  function preloadLogo(){
    try{
      const img=new Image();img.decoding='async';
      img.onload=()=>{try{const maxW=360,r=Math.min(1,maxW/Math.max(1,img.naturalWidth||img.width));const c=document.createElement('canvas');c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*r));c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*r));c.getContext('2d').drawImage(img,0,0,c.width,c.height);logoData=c.toDataURL('image/png');}catch(_){}};
      img.src=LOGO+'?v='+REV;
    }catch(_){}
  }

  function lockPrOutlet(){
    const el=document.getElementById('pr-outlet');if(!el)return;
    const lukluk=[...el.options].find(o=>/pixel\s*lukluk/i.test(String(o.textContent||o.value||'')));
    if(lukluk)el.value=lukluk.value;el.disabled=true;el.setAttribute('aria-disabled','true');
    const group=el.closest('.form-group');if(group)group.style.display='none';
  }

  function patchShowPrForm(){
    if(typeof window.showPRForm!=='function'||window.showPRForm.__pxl0031d)return;
    const old=window.showPRForm;window.showPRForm=function(){const out=old.apply(this,arguments);lockPrOutlet();return out;};
    window.showPRForm.__pxl0031d=true;
  }

  const text=v=>String(v??'-');
  const money=v=>'Rp '+Number(v||0).toLocaleString('id-ID');
  const dateLong=v=>{try{return v?new Date(v).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';}catch(_){return '-';}};
  const dateShort=v=>{try{return v?new Date(v).toLocaleDateString('id-ID'):'-';}catch(_){return '-';}};
  function sig(doc,data,x,y,w=28,h=13){if(typeof data!=='string'||!data.startsWith('data:image/'))return;try{doc.addImage(data,'PNG',x,y,w,h,undefined,'FAST');}catch(_){}}

  function directExportPRPDF(id){
    try{
      const p=(typeof prData!=='undefined'&&Array.isArray(prData))?prData.find(x=>x.id===id):null;
      if(!p){alert('PR tidak ditemukan.');return;}
      const jsPDF=window.jspdf?.jsPDF;if(!jsPDF){alert('Library PDF belum siap. Silakan refresh halaman.');return;}
      const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      const PW=210,PH=297,ML=12,MR=12,CW=PW-ML-MR;let y=13;

      // Header classic: bordered box, logo left, title right.
      doc.setDrawColor(0);doc.setLineWidth(.45);doc.rect(ML,y,CW,22);
      if(logoData){try{doc.addImage(logoData,'PNG',ML+4,y+5,38,10,'PXL_PR_LOGO_0031D','FAST');}catch(_){}}
      doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('PURCHASE REQUEST',PW-MR-4,y+9,{align:'right'});
      y+=27;

      // Info block matching old report (no green table / no bordered matrix).
      const lx=ML,lv=ML+28,rx=ML+92,rv=ML+120;
      doc.setFontSize(7.7);
      const infoRow=(label,val,label2,val2,yy)=>{doc.setFont('helvetica','bold');doc.text(label,lx,yy);doc.setFont('helvetica','normal');doc.text(text(val),lv,yy,{maxWidth:58});if(label2){doc.setFont('helvetica','bold');doc.text(label2,rx,yy);doc.setFont('helvetica','normal');doc.text(text(val2),rv,yy,{maxWidth:PW-MR-rv});}};
      infoRow('No. PR',p.pr_number,'Departemen',p.department||'Pixel',y);
      infoRow('Tanggal',dateLong(p.pr_date||p.created_at),'Nama Pemohon',p.requester,y+6);
      doc.setFont('helvetica','bold');doc.text('Alasan Permintaan',lx,y+12);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(text(p.reason||'-'),CW-34),lv,y+12);
      y+=25;doc.setLineWidth(.45);doc.line(ML,y,PW-MR,y);y+=5;

      const items=Array.isArray(p.items)?p.items:[];
      const totalAll=Number(p.total_amount||p.total||items.reduce((s,it)=>s+Number(it.qty||it.quantity||0)*Number(it.unit_price||it.price||0),0));
      const body=items.map((it,i)=>{
        const qty=Number(it.qty||it.quantity||0),price=Number(it.unit_price||it.price||0);
        return [String(i+1),text(it.item_name||it.name||it.description||'-'),qty.toLocaleString('id-ID'),text(it.unit||it.satuan||'-'),price?money(price):'-',price?money(qty*price):'-',text(it.stock_qty??it.stock??'-'),text(it.supplier_name||it.supplier||'-'),text(it.notes||it.keterangan||'-')];
      });
      if(doc.autoTable){
        doc.autoTable({startY:y,head:[['No','Deskripsi','Qty','Satuan','Harga/Unit','Total','Stock','Supplier','Keterangan']],body,theme:'grid',margin:{left:ML,right:MR},styles:{font:'helvetica',fontSize:6.2,cellPadding:1.4,lineColor:[0,0,0],lineWidth:.25,textColor:[0,0,0],valign:'middle'},headStyles:{fillColor:[225,225,225],textColor:[0,0,0],fontStyle:'bold',lineColor:[0,0,0],lineWidth:.25},columnStyles:{0:{cellWidth:9},1:{cellWidth:47},2:{cellWidth:11,halign:'center'},3:{cellWidth:14},4:{cellWidth:23,halign:'right'},5:{cellWidth:24,halign:'right'},6:{cellWidth:12,halign:'center'},7:{cellWidth:20},8:{cellWidth:26}},didDrawPage:()=>{}});
        y=doc.lastAutoTable.finalY;
        doc.setFillColor(220,220,220);doc.setDrawColor(0);doc.setLineWidth(.35);doc.rect(ML,y,CW,7,'FD');
        doc.setFont('helvetica','bold');doc.setFontSize(7.3);doc.text('TOTAL KESELURUHAN',ML+2,y+4.7);doc.text(money(totalAll),ML+128,y+4.7,{align:'right'});y+=12;
      }

      if(p.remarks){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Remarks: '+text(p.remarks),ML,y,{maxWidth:CW});y+=8;}
      if(y>185){doc.addPage();y=18;}

      // Signature layout classic with lines.
      const reqSig=p.approver1_signature||p.requester_signature||null,sig2=p.approver_signature||null;
      const topY=y+8,topW=82;
      const drawTop=(x,label,name,sdata,d)=>{doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text(label,x+topW/2,topY,{align:'center'});sig(doc,sdata,x+topW/2-14,topY+6,28,14);if(d){doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text(d,x+topW/2,topY+25,{align:'center'});}doc.setDrawColor(0);doc.setLineWidth(.35);doc.line(x+5,topY+29,x+topW-5,topY+29);if(name){doc.setFont('helvetica','bold');doc.setFontSize(6.8);doc.text(name,x+topW/2,topY+36,{align:'center'});}};
      drawTop(ML,'Requested by',text(p.requester),reqSig,p.approved1_at?dateShort(p.approved1_at):dateShort(p.created_at||p.pr_date));
      drawTop(PW-MR-topW,'Accounting','',null,'');

      const rowY=topY+70,w=CW/3;
      const approvals=[['I Putu Gede Arsa Pradnyana','Managing Director',null,''],['Ida Bagus Jara Amara','Chief Financial Officer',null,''],['I Putu Eka Hendrayana','Chief of Marketing & Store Manager',sig2,p.approved_at?dateShort(p.approved_at):'']];
      approvals.forEach((a,i)=>{const x=ML+i*w;doc.setFont('helvetica','bold');doc.setFontSize(7.3);doc.text('Approved by',x+w/2,rowY,{align:'center'});sig(doc,a[2],x+w/2-12,rowY+7,24,13);if(a[3]){doc.setFont('helvetica','normal');doc.setFontSize(5.8);doc.text(a[3],x+w/2,rowY+26,{align:'center'});}doc.line(x+5,rowY+31,x+w-5,rowY+31);doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text(a[0],x+w/2,rowY+38,{align:'center',maxWidth:w-8});doc.setFont('helvetica','normal');doc.setFontSize(5.7);doc.text(a[1],x+w/2,rowY+45,{align:'center',maxWidth:w-8});});

      const pages=doc.getNumberOfPages();for(let pg=1;pg<=pages;pg++){doc.setPage(pg);doc.setDrawColor(0);doc.setLineWidth(.35);doc.line(ML,PH-9,PW-MR,PH-9);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(100);doc.text(`${p.pr_number||''} | Dicetak: ${new Date().toLocaleString('id-ID')} | Hal ${pg}/${pages}`,PW/2,PH-5,{align:'center'});}
      doc.save(`PR_${(p.pr_number||'draft').replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
    }catch(e){console.error(REV+' export error',e);alert('Gagal membuat PDF PR: '+(e?.message||e));}
  }

  function install(){patchShowPrForm();lockPrOutlet();window.exportPRPDF=directExportPRPDF;setTimeout(()=>{patchShowPrForm();lockPrOutlet();window.exportPRPDF=directExportPRPDF;},300);}
  preloadLogo();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.PXL_URG_0031={revision:REV,directExportPRPDF};
})();
