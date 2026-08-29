/* PXL-URG-0031C — direct fast PR PDF renderer. PR numbering/calculation logic unchanged. */
(function(){
  'use strict';
  const REV='PXL-URG-0031C';
  const LOGO='/pixel-solusindo-logo.png';
  let logoData=null;

  function preloadLogo(){
    try{
      const img=new Image();
      img.decoding='async';
      img.onload=()=>{
        try{
          const maxW=360;
          const ratio=Math.min(1,maxW/Math.max(1,img.naturalWidth||img.width));
          const c=document.createElement('canvas');
          c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*ratio));
          c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*ratio));
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          logoData=c.toDataURL('image/png');
        }catch(_){}
      };
      img.src=LOGO+'?v='+REV;
    }catch(_){}
  }

  function lockPrOutlet(){
    const el=document.getElementById('pr-outlet');
    if(!el)return;
    const lukluk=[...el.options].find(o=>/pixel\s*lukluk/i.test(String(o.textContent||o.value||'')));
    if(lukluk)el.value=lukluk.value;
    el.disabled=true;
    el.setAttribute('aria-disabled','true');
    const group=el.closest('.form-group');
    if(group)group.style.display='none';
  }

  function patchShowPrForm(){
    if(typeof window.showPRForm!=='function'||window.showPRForm.__pxl0031c)return;
    const old=window.showPRForm;
    window.showPRForm=function(){const out=old.apply(this,arguments);lockPrOutlet();return out;};
    window.showPRForm.__pxl0031c=true;
  }

  function money(v){return 'Rp '+Number(v||0).toLocaleString('id-ID');}
  function text(v){return String(v??'-');}
  function safeDate(v){try{return v?new Date(v).toLocaleDateString('id-ID'):'-';}catch(_){return '-';}}

  function addEmbeddedSignature(doc,data,x,y,w=28,h=12){
    if(typeof data!=='string'||!data.startsWith('data:image/'))return false;
    try{doc.addImage(data,'PNG',x,y,w,h,undefined,'FAST');return true;}catch(_){return false;}
  }

  function directExportPRPDF(id){
    try{
      const p=(typeof prData!=='undefined'&&Array.isArray(prData))?prData.find(x=>x.id===id):null;
      if(!p){alert('PR tidak ditemukan.');return;}
      const jsPDF=window.jspdf?.jsPDF;
      if(!jsPDF){alert('Library PDF belum siap. Silakan refresh halaman.');return;}

      const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      const PW=210, PH=297, ML=14, MR=14, CW=PW-ML-MR;
      let y=14;

      if(logoData){try{doc.addImage(logoData,'PNG',ML,y-2,34,9,'PXL_PR_LOGO_0031C','FAST');}catch(_){}}
      doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(0,0,0);
      doc.text('PURCHASE REQUEST',PW-MR,y+6,{align:'right'});
      y+=20;

      doc.setDrawColor(210);doc.setLineWidth(.2);
      const rowH=8;
      const info=[
        ['No. PR',text(p.pr_number),'Tanggal',safeDate(p.pr_date||p.created_at)],
        ['Requester',text(p.requester),'Department',text(p.department||'Pixel')],
        ['Reason',text(p.reason||'-'),'Status',text(p.status||'-')]
      ];
      info.forEach(r=>{
        doc.rect(ML,y,CW,rowH);
        const c1=25,c2=66,c3=25;
        doc.setFontSize(8);doc.setFont('helvetica','bold');doc.text(r[0],ML+2,y+5);
        doc.setFont('helvetica','normal');doc.text(r[1],ML+c1+2,y+5,{maxWidth:c2-4});
        doc.setFont('helvetica','bold');doc.text(r[2],ML+c1+c2+2,y+5);
        doc.setFont('helvetica','normal');doc.text(r[3],ML+c1+c2+c3+2,y+5,{maxWidth:CW-c1-c2-c3-4});
        y+=rowH;
      });
      y+=5;

      const items=Array.isArray(p.items)?p.items:[];
      const body=items.map((it,i)=>[
        String(i+1),
        text(it.item_name||it.name||it.description||'-'),
        Number(it.qty||it.quantity||0).toLocaleString('id-ID'),
        text(it.unit||it.satuan||'-'),
        money(it.unit_price||it.price||0),
        money((Number(it.qty||it.quantity||0))*(Number(it.unit_price||it.price||0)))
      ]);
      if(doc.autoTable){
        doc.autoTable({
          startY:y,
          head:[['No','Item / Description','Qty','Unit','Unit Price','Total']],
          body,
          theme:'grid',
          styles:{font:'helvetica',fontSize:7,cellPadding:2},
          headStyles:{fontStyle:'bold'},
          columnStyles:{0:{cellWidth:10},1:{cellWidth:72},2:{cellWidth:16,halign:'right'},3:{cellWidth:18},4:{cellWidth:28,halign:'right'},5:{cellWidth:32,halign:'right'}}
        });
        y=doc.lastAutoTable.finalY+6;
      }else{
        doc.setFontSize(8);
        body.forEach(r=>{doc.text(r.join(' | '),ML,y);y+=5;});
      }

      const total=Number(p.total_amount||p.total||items.reduce((s,it)=>s+(Number(it.qty||it.quantity||0)*Number(it.unit_price||it.price||0)),0));
      doc.setFont('helvetica','bold');doc.setFontSize(9);
      doc.text('TOTAL',PW-MR-45,y,{align:'left'});doc.text(money(total),PW-MR,y,{align:'right'});
      y+=10;
      if(p.remarks){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Remarks: '+text(p.remarks),ML,y,{maxWidth:CW});y+=10;}

      if(y>220){doc.addPage();y=20;}
      const createdAt=safeDate(p.created_at||p.pr_date);
      const reqSig=p.approver1_signature||p.requester_signature||null;
      const sig2=p.approver_signature||null;
      const approvals=[
        {x:ML,w:80,label:'Requested by',name:text(p.requester),sig:reqSig,date:p.approved1_at?safeDate(p.approved1_at):createdAt},
        {x:PW-MR-80,w:80,label:'Accounting',name:'',sig:null,date:''}
      ];
      approvals.forEach(a=>{
        doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(a.label,a.x+a.w/2,y,{align:'center'});
        const sigY=y+4;
        addEmbeddedSignature(doc,a.sig,a.x+a.w/2-14,sigY,28,12);
        doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(a.name,a.x+a.w/2,y+20,{align:'center'});
        if(a.date)doc.text(a.date,a.x+a.w/2,y+25,{align:'center'});
      });
      y+=34;
      const row2=[
        ['Approved by','I Putu Gede Arsa Pradnyana','Managing Director',null,''],
        ['Approved by','Ida Bagus Jara Amara','Chief Financial Officer',null,''],
        ['Approved by','I Putu Eka Hendrayana','Chief of Marketing & Store Manager',sig2,p.approved_at?safeDate(p.approved_at):'']
      ];
      const w=CW/3;
      row2.forEach((a,i)=>{
        const x=ML+i*w;
        doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(a[0],x+w/2,y,{align:'center'});
        addEmbeddedSignature(doc,a[3],x+w/2-12,y+3,24,11);
        doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.text(a[1],x+w/2,y+18,{align:'center'});
        doc.text(a[2],x+w/2,y+22,{align:'center',maxWidth:w-4});
        if(a[4])doc.text(a[4],x+w/2,y+27,{align:'center'});
      });

      const totalPages=doc.getNumberOfPages();
      for(let pg=1;pg<=totalPages;pg++){
        doc.setPage(pg);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(100);
        doc.line(ML,PH-8,PW-MR,PH-8);
        doc.text(`${p.pr_number||''} | Dicetak: ${new Date().toLocaleString('id-ID')} | Hal ${pg}/${totalPages}`,PW/2,PH-4,{align:'center'});
      }

      doc.save(`PR_${(p.pr_number||'draft').replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
    }catch(e){
      console.error(REV+' export error',e);
      alert('Gagal membuat PDF PR: '+(e?.message||e));
    }
  }

  function install(){
    patchShowPrForm();lockPrOutlet();
    // Replace the original PR PDF generator entirely to avoid the old slow/hanging path.
    window.exportPRPDF=directExportPRPDF;
    setTimeout(()=>{patchShowPrForm();lockPrOutlet();window.exportPRPDF=directExportPRPDF;},300);
  }

  preloadLogo();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.PXL_URG_0031={revision:REV,directExportPRPDF};
})();
