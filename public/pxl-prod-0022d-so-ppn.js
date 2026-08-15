/* PXL-PROD-0022D — PPN manual per item / check all untuk SO Operasional & Project. */
(function(){
  'use strict';

  const REV='PXL-PROD-0022D';
  const NAVY=[18,49,88], ORANGE=[231,126,50], SITE_GRAY=[224,224,224];
  let installed=false;
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
  const idr=v=>Math.round(n(v)).toLocaleString('id-ID');
  const rp=v=>'Rp '+idr(v);
  const $=id=>document.getElementById(id);
  const safeFile=v=>String(v||'quotation').replace(/[^a-zA-Z0-9_-]+/g,'_');

  function isProjectMode(){return $('pxlSoMode')?.value==='project';}
  function getOrders(){try{return typeof D!=='undefined'&&Array.isArray(D?.sales_orders)?D.sales_orders:[];}catch(_){return [];}}
  function findSO(id){return getOrders().find(x=>String(x.id)===String(id))||null;}
  function isProjectSO(so){return (Array.isArray(so?.items)?so.items:[]).some(x=>x?.site_id||x?.site_name);}
  function rate(){return Math.max(0,n($('pxlPpnRate')?.value));}

  function installStyles(){
    if($('pxlPpnStyles')) return;
    const s=document.createElement('style');s.id='pxlPpnStyles';s.textContent=`
      .pxl-ppn-panel{grid-column:1/-1;display:grid;grid-template-columns:minmax(170px,240px) minmax(180px,260px) 1fr;gap:10px;align-items:end;border:1px solid var(--line,#e4e1d8);border-radius:10px;padding:11px;background:#fffdf9;margin-top:2px}
      .pxl-ppn-panel label{display:block}.pxl-ppn-checkall{display:flex;align-items:center;gap:8px;height:38px}.pxl-ppn-checkall input{width:auto}.pxl-ppn-help{color:var(--muted,#756f66);font-size:11px;padding-bottom:9px}
      .pxl-ppn-cell{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:62px}.pxl-ppn-cell label{white-space:nowrap}.pxl-ppn-item{width:auto!important;margin:7px 0 10px}
      .totals.pxl-with-ppn{grid-template-columns:repeat(4,1fr)}
      @media(max-width:1000px){.pxl-ppn-panel{grid-template-columns:1fr 1fr}.pxl-ppn-help{grid-column:1/-1}.totals.pxl-with-ppn{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.pxl-ppn-panel,.totals.pxl-with-ppn{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function installPanel(){
    if($('pxlPpnPanel')) return;
    const totals=document.querySelector('.totals'); if(!totals) return;
    const panel=document.createElement('div');panel.id='pxlPpnPanel';panel.className='pxl-ppn-panel';
    panel.innerHTML=`<div><label>PPN %</label><input id="pxlPpnRate" type="number" min="0" step="0.01" value="0" placeholder="Contoh: 11 atau 12"></div>
      <label class="pxl-ppn-checkall"><input id="pxlPpnCheckAll" type="checkbox"> Check Semua Item</label>
      <div class="pxl-ppn-help">Centang item satu per satu atau gunakan Check Semua Item. PPN hanya dihitung untuk item yang dicentang.</div>`;
    totals.parentElement.insertBefore(panel,totals);
    totals.classList.add('pxl-with-ppn');
    if(!$('ppnTotal')){
      const box=document.createElement('div');box.className='total-box';box.innerHTML='<span class="label">PPN</span><strong id="ppnTotal">Rp 0</strong>';
      const grand=$('grandTotal')?.closest('.total-box');
      if(grand) totals.insertBefore(box,grand); else totals.appendChild(box);
    }
    $('pxlPpnRate').addEventListener('input',()=>{
      const r=rate(); document.querySelectorAll('.pxl-ppn-item:checked').forEach(cb=>{const row=cb.closest('.line-row');if(row)row.dataset.ppnRate=String(r);});
      window.updateTotals?.();
    });
    $('pxlPpnCheckAll').addEventListener('change',e=>{
      const checked=e.target.checked,r=rate();
      document.querySelectorAll('.line-row').forEach(row=>{const cb=row.querySelector('.pxl-ppn-item');if(!cb)return;cb.checked=checked;row.dataset.ppnApplied=checked?'1':'0';row.dataset.ppnRate=checked?String(r):'0';});
      window.updateTotals?.();
    });
  }

  function decorateRow(row,data={}){
    if(!row||row.querySelector('.pxl-ppn-cell')) return;
    const applied=data.ppn_applied===true||String(data.ppn_applied)==='true'||n(data.ppn_rate)>0;
    const storedRate=applied?n(data.ppn_rate):rate();
    row.dataset.ppnApplied=applied?'1':'0'; row.dataset.ppnRate=String(storedRate||0);
    const cell=document.createElement('div');cell.className='pxl-ppn-cell';cell.innerHTML=`<label>PPN</label><input class="pxl-ppn-item" type="checkbox" ${applied?'checked':''}>`;
    const remove=row.querySelector('.remove'); if(remove) row.insertBefore(cell,remove); else row.appendChild(cell);
    const cb=cell.querySelector('.pxl-ppn-item');
    cb.addEventListener('change',()=>{row.dataset.ppnApplied=cb.checked?'1':'0';row.dataset.ppnRate=cb.checked?String(rate()):'0';syncCheckAll();window.updateTotals?.();});
  }

  function decorateExisting(){document.querySelectorAll('.line-row').forEach(row=>decorateRow(row,{}));syncCheckAll();}
  function syncCheckAll(){const all=[...document.querySelectorAll('.pxl-ppn-item')];const c=$('pxlPpnCheckAll');if(c)c.checked=!!all.length&&all.every(x=>x.checked);}
  function syncRateFromRows(){const rates=[...document.querySelectorAll('.line-row')].filter(r=>r.dataset.ppnApplied==='1').map(r=>n(r.dataset.ppnRate)).filter(x=>x>0);if(rates.length&&$('pxlPpnRate'))$('pxlPpnRate').value=String(rates[0]);syncCheckAll();}

  function taxForRows(rows){return [...rows].reduce((sum,row)=>{if(row.dataset.ppnApplied!=='1')return sum;return sum+n(row.querySelector('.qty')?.value)*n(row.querySelector('.price')?.value)*n(row.dataset.ppnRate)/100;},0);}
  function taxDataFromDom(){return [...document.querySelectorAll('.material-row'),...document.querySelectorAll('.service-row')].map(row=>({applied:row.dataset.ppnApplied==='1',rate:n(row.dataset.ppnRate)}));}

  function dateId(value){if(!value)return '-';const p=String(value).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(value);}
  async function ensureJsPDF(){if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;try{if(window.parent&&window.parent!==window&&window.parent.jspdf?.jsPDF)return window.parent.jspdf.jsPDF;}catch(_){}await new Promise((resolve,reject)=>{const e=document.querySelector('script[data-pxl-22d-jspdf]');if(e){e.addEventListener('load',resolve,{once:true});e.addEventListener('error',reject,{once:true});return;}const s=document.createElement('script');s.dataset.pxl22dJspdf='1';s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});if(!window.jspdf?.jsPDF)throw new Error('Library PDF belum tersedia.');return window.jspdf.jsPDF;}
  async function imageData(url){try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)return null;const b=await r.blob();return await new Promise(resolve=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>resolve(null);fr.readAsDataURL(b);});}catch(_){return null;}}
  function taxSummary(items){const selected=(items||[]).filter(x=>x.ppn_applied&&n(x.ppn_rate)>0);const amount=selected.reduce((s,x)=>s+n(x.qty)*n(x.unit_price)*n(x.ppn_rate)/100,0);const rates=[...new Set(selected.map(x=>n(x.ppn_rate)))];return {amount,label:rates.length===1?`PPN ${rates[0]}%`:'PPN'};}

  function drawPixelHeader(doc,logo){doc.setFillColor(255,255,255);doc.rect(10,10,190,29,'F');if(logo){try{doc.addImage(logo,'PNG',14,15,58,18);}catch(_){}}doc.setTextColor(0,0,0);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('PIXEL SOLUSINDO',76,27);doc.setFontSize(25);doc.text('QUOTATION',196,28,{align:'right'});doc.setFillColor(...NAVY);doc.rect(10,39,126,1.4,'F');doc.setFillColor(...ORANGE);doc.rect(136,39,64,1.4,'F');}
  function drawCKHeader(doc,logo){doc.setFillColor(255,255,255);doc.rect(10,9,190,31,'F');if(logo){try{doc.addImage(logo,'PNG',13,12,48,24,undefined,'FAST');}catch(_){}}doc.setTextColor(0,0,0);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('CV. CIPTA KREASITAMA',69,25);doc.setFontSize(23);doc.text('QUOTATION',198,27,{align:'right'});doc.setFillColor(...NAVY);doc.rect(10,40,126,1.4,'F');doc.setFillColor(...ORANGE);doc.rect(136,40,64,1.4,'F');}

  function drawCols(doc,state){doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(0,0,0);doc.text('NO',16,state.y,{align:'center'});doc.text('DESCRIPTION',66,state.y,{align:'center'});doc.text('QTY',119.5,state.y,{align:'center'});doc.text('UNIT',135.5,state.y,{align:'center'});doc.text('PRICE',153,state.y);doc.text('TOTAL',183,state.y);state.y+=4;doc.setDrawColor(218,218,218);doc.line(10,state.y,200,state.y);state.y+=3;}
  function groupSites(items){const m=new Map();(items||[]).forEach((x,i)=>{const k=String(x.site_id||`site-${x.site_order||1}`);if(!m.has(k))m.set(k,{name:x.site_name||`Site ${String(x.site_order||1).padStart(2,'0')}`,order:n(x.site_order)||1,rows:[]});m.get(k).rows.push({...x,_order:n(x.site_item_order)||i+1});});const a=[...m.values()].sort((a,b)=>a.order-b.order);a.forEach(s=>s.rows.sort((a,b)=>a._order-b._order));return a;}
  function ensureProjectPage(doc,state,need,logo){if(state.y+need<=276)return;doc.addPage();drawCKHeader(doc,logo);state.y=49;drawCols(doc,state);}
  function drawSite(doc,state,site,logo){ensureProjectPage(doc,state,14,logo);doc.setFillColor(...SITE_GRAY);doc.rect(23,state.y,88,6.5,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(String(site.name||'Site'),27,state.y+4.4);state.y+=8;(site.rows||[]).forEach((row,i)=>{const d=String(row.name||row.item_name||row.description||'-');const lines=doc.splitTextToSize(d,78);const h=Math.max(6.5,lines.length*3.5+2);ensureProjectPage(doc,state,h+2,logo);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(String(i+1),16,state.y+4,{align:'center'});doc.text(lines,23,state.y+4);doc.text(String(n(row.qty)),119.5,state.y+4,{align:'center'});doc.text(String(row.unit||'-'),135.5,state.y+4,{align:'center'});doc.text(`IDR ${idr(row.unit_price)}`,153,state.y+4);doc.text(`IDR ${idr(n(row.qty)*n(row.unit_price))}`,183,state.y+4);doc.setDrawColor(232,232,232);doc.line(10,state.y+h,200,state.y+h);state.y+=h;});state.y+=5;}

  async function exportProject(so){const JsPDF=await ensureJsPDF(),logo=await imageData('/ck-logo.png?v='+REV),doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'}),state={y:49},items=Array.isArray(so.items)?so.items:[];drawCKHeader(doc,logo);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Customer:',10,50);doc.setFont('helvetica','normal');doc.setFontSize(9);const customer=doc.splitTextToSize([so.customer_name,so.address||so.location].filter(Boolean).join('\n')||'-',86);doc.text(customer,10,56);[['Quotation No.',so.quotation_number||'-'],['SO No.',so.so_number||'-'],['Date',dateId(so.quotation_date||so.created_at)],['Expired',dateId(so.quotation_valid_until)]].forEach((e,i)=>{const y=51+i*5.5;doc.setFontSize(8.5);doc.text(e[0],137,y);doc.text(String(e[1]),199,y,{align:'right'});});state.y=Math.max(82,58+customer.length*4);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(String(so.quotation_title||so.project_name||'Penawaran Project'),105,state.y,{align:'center'});state.y+=11;drawCols(doc,state);groupSites(items).forEach(s=>drawSite(doc,state,s,logo));ensureProjectPage(doc,state,30,logo);const dpp=items.reduce((s,x)=>s+n(x.qty)*n(x.unit_price),0),tax=taxSummary(items);doc.setDrawColor(...NAVY);doc.setLineWidth(.8);doc.line(137,state.y,200,state.y);state.y+=7;doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('DPP',137,state.y);doc.text('IDR',169,state.y);doc.text(idr(dpp),199,state.y,{align:'right'});state.y+=6;doc.text(tax.label,137,state.y);doc.text('IDR',169,state.y);doc.text(idr(tax.amount),199,state.y,{align:'right'});state.y+=7;doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('GRAND TOTAL',137,state.y);doc.text('IDR',169,state.y);doc.text(idr(dpp+tax.amount),199,state.y,{align:'right'});doc.setFillColor(...ORANGE);doc.rect(137,state.y+3,63,1.7,'F');for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(125,125,125);doc.text(`${so.quotation_number||'-'} | ${so.so_number||'-'} | Hal ${p}/${doc.getNumberOfPages()}`,105,293,{align:'center'});}doc.save(`Quotation_Project_${safeFile(so.quotation_number)}_${safeFile(so.so_number)}.pdf`);}

  function splitLines(items){const material=[],service=[];(items||[]).forEach(x=>{if(['service','jasa'].includes(String(x.item_type||x.type||'item').toLowerCase()))service.push(x);else material.push(x);});return {material,service};}
  function drawOpsSection(doc,state,title,rows,logo){if(state.y+18>270){doc.addPage();drawPixelHeader(doc,logo);state.y=48;}doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(title,10,state.y);state.y+=2;doc.setFillColor(...NAVY);doc.rect(10,state.y,190,1.1,'F');state.y+=6;drawCols(doc,state);rows.forEach((row,i)=>{const lines=doc.splitTextToSize(String(row.name||row.item_name||'-'),84);const h=Math.max(7,lines.length*4+2);if(state.y+h+8>270){doc.addPage();drawPixelHeader(doc,logo);state.y=48;drawCols(doc,state);}doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(String(i+1),16,state.y+4,{align:'center'});doc.text(lines,23,state.y+4);doc.text(String(n(row.qty)),119.5,state.y+4,{align:'center'});doc.text(String(row.unit||'-'),137.5,state.y+4,{align:'center'});doc.text(`IDR ${idr(row.unit_price)}`,151,state.y+4);doc.text(`IDR ${idr(n(row.qty)*n(row.unit_price))}`,179,state.y+4);doc.setDrawColor(224,224,224);doc.line(10,state.y+h,200,state.y+h);state.y+=h;});state.y+=7;}
  async function exportOperational(so){const JsPDF=await ensureJsPDF(),logo=await imageData('/pixel-solusindo-logo.png?v='+REV),doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'}),items=Array.isArray(so.items)?so.items:[],parts=splitLines(items),state={y:49};drawPixelHeader(doc,logo);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('Customer:',10,50);doc.setFont('helvetica','normal');doc.setFontSize(9);const customer=doc.splitTextToSize([so.customer_name,so.address||so.location,so.customer_phone].filter(Boolean).join('\n')||'-',86);doc.text(customer,10,56);[['Quotation No.',so.quotation_number||'-'],['SO No.',so.so_number||'-'],['Date',dateId(so.quotation_date||so.created_at)],['Expired',dateId(so.quotation_valid_until)]].forEach((e,i)=>{const y=51+i*5.5;doc.setFontSize(8.5);doc.text(e[0],137,y);doc.text(String(e[1]),199,y,{align:'right'});});state.y=Math.max(84,58+customer.length*4);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(String(so.quotation_title||so.project_name||'Penawaran'),105,state.y,{align:'center'});state.y+=13;drawOpsSection(doc,state,'A. ITEM DETAILS',parts.material,logo);drawOpsSection(doc,state,'B. SERVICE DETAILS',parts.service,logo);if(state.y+50>270){doc.addPage();drawPixelHeader(doc,logo);state.y=48;}doc.setFillColor(...NAVY);doc.rect(10,state.y,190,1.2,'F');state.y+=10;doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('Jika ada pertanyaan mengenai penawaran ini, silakan hubungi:',10,state.y);doc.text('Marketing Pixel Solusindo (+62 877-3477-2999)',10,state.y+6);const mat=parts.material.reduce((s,x)=>s+n(x.qty)*n(x.unit_price),0),svc=parts.service.reduce((s,x)=>s+n(x.qty)*n(x.unit_price),0),tax=taxSummary(items);let y=state.y;[['ITEM PRICES',mat],['SERVICE PRICES',svc],[tax.label,tax.amount]].forEach((e,i)=>{const yy=y+i*7;doc.text(e[0],137,yy);doc.text('IDR',169,yy);doc.text(idr(e[1]),199,yy,{align:'right'});});const gy=y+26;doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('GRAND TOTAL',137,gy);doc.text('IDR',169,gy);doc.text(idr(mat+svc+tax.amount),199,gy,{align:'right'});doc.setFillColor(...ORANGE);doc.rect(137,gy+3,63,1.7,'F');for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(125,125,125);doc.text(`${so.quotation_number||'-'} | ${so.so_number||'-'} | Hal ${p}/${doc.getNumberOfPages()}`,105,293,{align:'center'});}doc.save(`Quotation_${safeFile(so.quotation_number)}_${safeFile(so.so_number)}.pdf`);}

  async function exportQuotation(id){const so=findSO(id);if(!so)return;try{if(isProjectSO(so))await exportProject(so);else await exportOperational(so);}catch(e){try{toast(e.message||'Gagal membuat PDF Penawaran.');}catch(_){alert(e.message||'Gagal membuat PDF Penawaran.');}}}

  function install(){
    if(installed)return;
    if(typeof window.addMaterial!=='function'||typeof window.collect!=='function'||typeof window.updateTotals!=='function')return setTimeout(install,100);
    installed=true;installStyles();installPanel();

    const oldAddMaterial=window.addMaterial,oldAddService=window.addService,oldCollect=window.collect,oldTotals=window.updateTotals,oldEdit=window.editSO,oldReset=window.reset;
    window.addMaterial=function(data={}){const before=document.querySelectorAll('.material-row').length;const r=oldAddMaterial(data);const rows=document.querySelectorAll('.material-row');decorateRow(rows[rows.length-1],data);return r;};
    window.addService=function(data={}){const r=oldAddService(data);const rows=document.querySelectorAll('.service-row');decorateRow(rows[rows.length-1],data);return r;};
    window.updateTotals=function(){const result=oldTotals?.()||{};if(isProjectMode()){if($('ppnTotal'))$('ppnTotal').textContent=rp(result.ppnTotal||0);return result;}const ppn=taxForRows(document.querySelectorAll('.line-row'));const mat=n(result.materialSubtotal),svc=n(result.serviceSubtotal);if($('ppnTotal'))$('ppnTotal').textContent=rp(ppn);if($('grandTotal'))$('grandTotal').textContent=rp(mat+svc+ppn);return {...result,ppnTotal:ppn,grandTotal:mat+svc+ppn};};
    window.collect=function(){const payload=oldCollect();if(isProjectMode())return payload;const taxes=taxDataFromDom();(payload.items||[]).forEach((x,i)=>{const t=taxes[i]||{};x.ppn_applied=!!t.applied;x.ppn_rate=t.applied?n(t.rate):0;x.ppn_amount=t.applied?n(x.qty)*n(x.unit_price)*n(t.rate)/100:0;});const ppn=(payload.items||[]).reduce((s,x)=>s+n(x.ppn_amount),0);const base=n(payload.material_subtotal)+n(payload.service_subtotal);payload.quotation_total=base+ppn;payload.total_amount=base+ppn;return payload;};
    window.editSO=function(id){const r=oldEdit?.(id);setTimeout(()=>{decorateExisting();syncRateFromRows();window.updateTotals?.();},0);return r;};
    window.reset=function(){const r=oldReset?.();setTimeout(()=>{if($('pxlPpnRate'))$('pxlPpnRate').value='0';decorateExisting();syncCheckAll();window.updateTotals?.();},0);return r;};

    decorateExisting();
    const observer=new MutationObserver(()=>{decorateExisting();window.updateTotals?.();});observer.observe(document.body,{childList:true,subtree:true});

    window.downloadQuotationPDF=exportQuotation;
    document.addEventListener('click',e=>{const btn=e.target.closest?.('[data-quote-pdf],[data-act="pdf"]');if(!btn)return;const id=btn.dataset.quotePdf||btn.dataset.id;if(!id)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();exportQuotation(id);},true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
