/* PXL-URG-0038C — Add customer name to Ticket Detail Copy WhatsApp report. UI only. */
(function(){
  'use strict';
  const REV='PXL-URG-0038C';
  const text=v=>String(v??'').trim();
  const first=(obj,keys)=>{for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&text(v)!=='')return v;}return '';};
  const titleCase=v=>text(v).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const reportDate=v=>{if(!v)return '-';const d=new Date(v);if(!Number.isFinite(d.getTime()))return text(v)||'-';try{return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});}catch(_){return d.toLocaleDateString('id-ID');}};

  function allKnown(){
    const active=(()=>{try{return typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[]}catch(_){return[]}})();
    const archive=(()=>{try{return typeof archivedTickets!=='undefined'&&Array.isArray(archivedTickets)?archivedTickets:[]}catch(_){return[]}})();
    return active.concat(archive);
  }
  function byId(id){return allKnown().find(t=>String(t?.id)===String(id))||null;}
  function fields(t){return {
    wo:first(t,['wo_number','wo_no','work_order_number','work_order_no','wo','number','ticket_number','ticket_no','code']),
    so:first(t,['so_number','sales_order_number','source_so_number','sales_order_no','so_no','source_so','sales_order']),
    customer:first(t,['customer_name','customer','client_name','client']),
    project:first(t,['project_name','project','title','subject']),
    status:first(t,['status']),
    tech1:first(t,['technician_name','technician','assigned_to_name','assigned_to','technician_1_name','technician1_name']),
    tech2:first(t,['technician2_name','technician_2_name','technician2','assigned_to_2_name','assigned_to2_name','technician_2']),
    date:first(t,['worked_at','work_date','scheduled_at','scheduled_date','date','created_at'])
  };}
  function whatsappText(t){
    const f=fields(t);
    const tech=[text(f.tech1),text(f.tech2)].filter(Boolean);
    const techLine=tech.length>1?`👥 ${tech[0]} & ${tech[1]}`:tech.length?`👥 ${tech[0]}`:'👥 Belum Ditugaskan';
    const lines=[`Report Teknisi, ${reportDate(f.date)}.`,text(f.wo)||'WO -'];
    if(text(f.so))lines.push(text(f.so));
    if(text(f.customer))lines.push(`👤 ${text(f.customer)}`);
    lines.push(techLine,`📁 ${text(f.project)||'-'}.`,`Status: ${titleCase(f.status)||'-'}`);
    return lines.join('\n');
  }
  async function copyText(value){
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return true;}catch(_){}}
    const ta=document.createElement('textarea');ta.value=value;ta.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){ok=false;}ta.remove();return ok;
  }

  document.addEventListener('click',async function(e){
    const btn=e.target?.closest?.('#pxl-0038-wa');
    if(!btn)return;
    const modal=btn.closest('#pxl-0038-ticket-detail-modal');
    const ticket=byId(modal?.dataset?.ticketId);
    if(!ticket)return;
    e.preventDefault();e.stopImmediatePropagation();
    const old=btn.textContent;btn.disabled=true;
    const ok=await copyText(whatsappText(ticket));
    btn.textContent=ok?'✅ Tersalin':'⚠️ Gagal Copy';
    setTimeout(()=>{btn.disabled=false;btn.textContent=old;},1400);
  },true);

  window.PXL_URG_0038C={revision:REV,whatsappText:id=>{const t=byId(id);return t?whatsappText(t):'';}};
})();

// PXL-URG-0038D — isolated dual-technician resolver for Detail + WhatsApp.
(function(){
  'use strict';
  if(document.querySelector('script[data-pxl-ticket-dual-tech="0038D"]')) return;
  const script=document.createElement('script');
  script.dataset.pxlTicketDualTech='0038D';
  script.src='/pxl-urg-0038d-dual-technician.js?v=PXL-URG-0038D';
  document.head.appendChild(script);
})();
