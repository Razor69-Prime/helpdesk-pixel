/* PXL-URG-0038D — Dual technician resolver for Ticket Detail + Copy WhatsApp. UI only. */
(function(){
  'use strict';
  const REV='PXL-URG-0038D';
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

  function people(){
    const out=[];
    const add=list=>{if(Array.isArray(list))list.forEach(v=>{if(v&&typeof v==='object')out.push(v);});};
    try{add(typeof allUsers!=='undefined'?allUsers:[]);}catch(_){ }
    try{add(typeof users!=='undefined'?users:[]);}catch(_){ }
    try{add(typeof technicians!=='undefined'?technicians:[]);}catch(_){ }
    try{add(typeof technicianUsers!=='undefined'?technicianUsers:[]);}catch(_){ }
    return out;
  }

  function displayName(value){
    if(value==null)return '';
    if(typeof value==='object'){
      return text(value.name||value.full_name||value.display_name||value.username||value.email||'');
    }
    const raw=text(value);if(!raw)return '';
    const key=raw.toLowerCase();
    const found=people().find(p=>[p.id,p.user_id,p.technician_id,p.name,p.full_name,p.username,p.email].filter(Boolean).some(v=>text(v).toLowerCase()===key));
    if(found)return text(found.name||found.full_name||found.display_name||found.username||found.email||raw);
    if(/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(raw))return '';
    return raw;
  }

  function technicianNames(t){
    const values=[];
    const add=v=>{
      if(Array.isArray(v)){v.forEach(add);return;}
      const name=displayName(v);if(name)values.push(name);
    };
    add(t?.technicians);
    [
      t?.technician_1_name,t?.technician1_name,t?.technician_name,
      t?.technician_1,t?.technician,
      t?.technician_2_name,t?.technician2_name,t?.technician_2,
      t?.assigned_to_name,t?.assigned_to,t?.assigned_to_2_name,t?.assigned_to2_name,t?.assigned_to2
    ].forEach(add);
    const seen=new Set();
    return values.filter(name=>{const k=name.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;}).slice(0,2);
  }

  function fields(t){return {
    wo:first(t,['wo_number','wo_no','work_order_number','work_order_no','wo','number','ticket_number','ticket_no','code']),
    so:first(t,['so_number','sales_order_number','source_so_number','sales_order_no','so_no','source_so','sales_order']),
    customer:first(t,['customer_name','customer','client_name','client']),
    project:first(t,['project_name','project','title','subject']),
    status:first(t,['status']),
    date:first(t,['worked_at','work_date','scheduled_at','scheduled_date','date','created_at'])
  };}

  function whatsappText(t){
    const f=fields(t),tech=technicianNames(t);
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

  function setDetailValue(body,label,value){
    const labels=[...body.querySelectorAll('div')].filter(el=>text(el.textContent).toUpperCase()===label && el.children.length===0);
    labels.forEach(labelEl=>{
      const wrap=labelEl.parentElement;
      const valueEl=wrap?.children?.[1];
      if(valueEl)valueEl.textContent=value||'-';
    });
  }

  function patchModal(){
    const modal=document.getElementById('pxl-0038-ticket-detail-modal');
    if(!modal)return;
    const ticket=byId(modal.dataset.ticketId);if(!ticket)return;
    const tech=technicianNames(ticket);
    const body=modal.querySelector('#pxl-0038-body');
    if(body){setDetailValue(body,'TEKNISI 1',tech[0]||'-');setDetailValue(body,'TEKNISI 2',tech[1]||'-');}

    const oldBtn=modal.querySelector('#pxl-0038-wa,#pxl-0038d-wa');
    if(oldBtn && oldBtn.id!=='pxl-0038d-wa')oldBtn.id='pxl-0038d-wa';
    const btn=modal.querySelector('#pxl-0038d-wa');
    if(btn && !btn.dataset.pxl0038d){
      btn.dataset.pxl0038d='1';
      btn.onclick=async function(e){
        e?.preventDefault?.();e?.stopPropagation?.();
        const current=byId(modal.dataset.ticketId);if(!current)return alert('Work Order tidak ditemukan.');
        const old=btn.textContent;btn.disabled=true;
        const ok=await copyText(whatsappText(current));
        btn.textContent=ok?'✅ Tersalin':'⚠️ Gagal Copy';
        setTimeout(()=>{btn.disabled=false;btn.textContent=old;},1400);
      };
    }
  }

  let timer=null;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(patchModal,30);};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  document.addEventListener('click',e=>{if(e.target?.closest?.('.pxl-0038-detail-btn')){setTimeout(patchModal,0);setTimeout(patchModal,80);}},true);
  setInterval(patchModal,1500);
  setTimeout(patchModal,0);

  window.PXL_URG_0038D={revision:REV,technicians:id=>{const t=byId(id);return t?technicianNames(t):[];},whatsappText:id=>{const t=byId(id);return t?whatsappText(t):'';},refresh:patchModal};
})();
