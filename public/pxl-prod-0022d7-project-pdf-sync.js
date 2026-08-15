/* PXL-PROD-0022D7 — Project PDF harus sama dengan TOTAL item pada form (include PPN). */
(function(){
  'use strict';

  const REV='PXL-PROD-0022D7';
  const NAVY=[18,49,88], ORANGE=[231,126,50], SITE_GRAY=[224,224,224];
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const idr=v=>Math.round(n(v)).toLocaleString('id-ID');
  const safe=v=>String(v||'quotation').replace(/[^a-zA-Z0-9_-]+/g,'_');

  function orders(){try{return typeof D!=='undefined'&&Array.isArray(D?.sales_orders)?D.sales_orders:[];}catch(_){return [];}}
  function findSO(id){return orders().find(x=>String(x.id)===String(id))||null;}
  function isProject(so){return (Array.isArray(so?.items)?so.items:[]).some(x=>x?.site_id||x?.site_name);}
  function isTaxed(x){
    return x?.ppn_applied===true || String(x?.ppn_applied)==='true' || String(x?.ppn_applied)==='1';
  }
  function inclusiveUnit(x){
    const base=n(x?.unit_price);
    return isTaxed(x) ? base*(1+n(x?.ppn_rate)/100) : base;
  }
  function inclusiveLine(x){return n(x?.qty)*inclusiveUnit(x);}

  function dateId(value){
    if(!value)return '-';
    const p=String(value).slice(0,10).split('-');
    return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(value);
  }

  async function ensureJsPDF(){
    if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
    try{if(window.parent&&window.parent!==window&&window.parent.jspdf?.jsPDF)return window.parent.jspdf.jsPDF;}catch(_){}
    await new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-pxl-d7-jspdf]');
      if(old){
        if(window.jspdf?.jsPDF)return resolve();
        old.addEventListener('load',resolve,{once:true});
        old.addEventListener('error',reject,{once:true});
        return;
      }
      const s=document.createElement('script');
      s.dataset.pxlD7Jspdf='1';
      s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
    if(!window.jspdf?.jsPDF)throw new Error('Library PDF belum tersedia.');
    return window.jspdf.jsPDF;
  }

  async function imageData(url){
    try{
      const r=await fetch(url,{cache:'force-cache'});
      if(!r.ok)return null;
      const b=await r.blob();
      return await new Promise(resolve=>{
        const fr=new FileReader();
        fr.onload=()=>resolve(fr.result);fr.onerror=()=>resolve(null);
        fr.readAsDataURL(b);
      });
    }catch(_){return null;}
  }

  function groupSites(items){
    const m=new Map();
    (items||[]).forEach((x,i)=>{
      const key=String(x.site_id||`site-${x.site_order||1}`);
      if(!m.has(key))m.set(key,{
        name:x.site_name||`Site ${String(x.site_order||1).padStart(2,'0')}`,
        order:n(x.site_order)||1, rows:[]
      });
      m.get(key).rows.push({...x,_order:n(x.site_item_order)||i+1});
    });
    const out=[...m.values()].sort((a,b)=>a.order-b.order);
    out.forEach(s=>s.rows.sort((a,b)=>a._order-b._order));
    return out;
  }

  function header(doc,logo){
    doc.setFillColor(255,255,255);doc.rect(10,9,190,31,'F');
    if(logo){try{doc.addImage(logo,'PNG',13,12,48,24,undefined,'FAST');}catch(_){}}
    doc.setTextColor(0,0,0);doc.setFont('helvetica','bold');
    doc.setFontSize(16);doc.text('CV. CIPTA KREASITAMA',69,25);
    doc.setFontSize(23);doc.text('QUOTATION',198,27,{align:'right'});
    doc.setFillColor(...NAVY);doc.rect(10,40,126,1.4,'F');
    doc.setFillColor(...ORANGE);doc.rect(136,40,64,1.4,'F');
  }

  function cols(doc,state){
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(0,0,0);
    doc.text('NO',16,state.y,{align:'center'});
    doc.text('DESCRIPTION',66,state.y,{align:'center'});
    doc.text('QTY',119.5,state.y,{align:'center'});
    doc.text('UNIT',135.5,state.y,{align:'center'});
    doc.text('PRICE',153,state.y);
    doc.text('TOTAL',183,state.y);
    state.y+=4;doc.setDrawColor(218,218,218);doc.line(10,state.y,200,state.y);state.y+=3;
  }

  function ensure(doc,state,need,logo){
    if(state.y+need<=276)return;
    doc.addPage();header(doc,logo);state.y=49;cols(doc,state);
  }

  function site(doc,state,s,logo){
    ensure(doc,state,14,logo);
    doc.setFillColor(...SITE_GRAY);doc.rect(23,state.y,88,6.5,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(0,0,0);
    doc.text(String(s.name||'Site'),27,state.y+4.4);state.y+=8;

    (s.rows||[]).forEach((row,i)=>{
      const desc=String(row.name||row.item_name||row.description||'-');
      const lines=doc.splitTextToSize(desc,78);
      const h=Math.max(6.5,lines.length*3.5+2);
      ensure(doc,state,h+2,logo);
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(0,0,0);
      doc.text(String(i+1),16,state.y+4,{align:'center'});
      doc.text(lines,23,state.y+4);
      doc.text(String(n(row.qty)),119.5,state.y+4,{align:'center'});
      doc.text(String(row.unit||'-'),135.5,state.y+4,{align:'center'});
      doc.text(`IDR ${idr(inclusiveUnit(row))}`,153,state.y+4);
      doc.text(`IDR ${idr(inclusiveLine(row))}`,183,state.y+4);
      doc.setDrawColor(232,232,232);doc.line(10,state.y+h,200,state.y+h);
      state.y+=h;
    });
    state.y+=5;
  }

  async function exportProject(id){
    const so=findSO(id);
    if(!so)return;
    const JsPDF=await ensureJsPDF();
    const logo=await imageData('/ck-logo.png?v='+REV);
    const doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const items=Array.isArray(so.items)?so.items:[];
    const state={y:49};

    header(doc,logo);
    doc.setTextColor(0,0,0);doc.setFont('helvetica','bold');doc.setFontSize(8);
    doc.text('Customer:',10,50);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    const customer=doc.splitTextToSize([so.customer_name,so.address||so.location].filter(Boolean).join('\n')||'-',86);
    doc.text(customer,10,56);

    [['Quotation No.',so.quotation_number||'-'],['SO No.',so.so_number||'-'],
     ['Date',dateId(so.quotation_date||so.created_at)],['Expired',dateId(so.quotation_valid_until)]]
      .forEach((e,i)=>{
        const y=51+i*5.5;
        doc.setFontSize(8.5);doc.text(e[0],137,y);doc.text(String(e[1]),199,y,{align:'right'});
      });

    state.y=Math.max(82,58+customer.length*4);
    doc.setFont('helvetica','bold');doc.setFontSize(12);
    doc.text(String(so.quotation_title||so.project_name||'Penawaran Project'),105,state.y,{align:'center'});
    state.y+=11;cols(doc,state);

    groupSites(items).forEach(s=>site(doc,state,s,logo));

    ensure(doc,state,22,logo);
    const grand=items.reduce((sum,x)=>sum+inclusiveLine(x),0);
    doc.setDrawColor(...NAVY);doc.setLineWidth(.8);doc.line(137,state.y,200,state.y);
    state.y+=7;doc.setFont('helvetica','bold');doc.setFontSize(9.5);
    doc.text('GRAND TOTAL',137,state.y);doc.text('IDR',169,state.y);
    doc.text(idr(grand),199,state.y,{align:'right'});
    doc.setFillColor(...ORANGE);doc.rect(137,state.y+3,63,1.7,'F');

    const pages=doc.getNumberOfPages();
    for(let p=1;p<=pages;p++){
      doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(125,125,125);
      doc.text(`${so.quotation_number||'-'} | ${so.so_number||'-'} | Hal ${p}/${pages}`,105,293,{align:'center'});
    }

    doc.save(`Quotation_Project_${safe(so.quotation_number)}_${safe(so.so_number)}.pdf`);
  }

  // Capture-phase: hentikan generator Project lama sebelum onclick handler lainnya.
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-quote-pdf]');
    if(!btn)return;
    const id=btn.dataset.quotePdf;
    const so=findSO(id);
    if(!so||!isProject(so))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exportProject(id).catch(err=>{
      try{toast(err.message||'Gagal membuat PDF Project.');}catch(_){alert(err.message||'Gagal membuat PDF Project.');}
    });
  },true);

  window.PXL_PROD_0022D7={revision:REV,exportProject,inclusiveUnit,inclusiveLine};
})();
