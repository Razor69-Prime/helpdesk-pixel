/* PXL-URG-0038B — Read-only ticket detail modal + Copy WhatsApp report. UI only. */
(function(){
  'use strict';
  const REV='PXL-URG-0038B';
  const text=v=>String(v??'').trim();
  const first=(obj,keys)=>{for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&text(v)!=='')return v;}return '';};
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const prettyDate=v=>{if(!v)return '-';const d=new Date(v);if(!Number.isFinite(d.getTime()))return text(v)||'-';try{return d.toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});}catch(_){return d.toLocaleString('id-ID');}};
  const reportDate=v=>{if(!v)return '-';const d=new Date(v);if(!Number.isFinite(d.getTime()))return text(v)||'-';try{return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});}catch(_){return d.toLocaleDateString('id-ID');}};
  const titleCase=v=>text(v).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

  function activeTickets(){try{return typeof allTickets!=='undefined'&&Array.isArray(allTickets)?allTickets:[];}catch(_){return[];}}
  function archiveTickets(){try{return typeof archivedTickets!=='undefined'&&Array.isArray(archivedTickets)?archivedTickets:[];}catch(_){return[];}}
  function allKnown(){return activeTickets().concat(archiveTickets());}
  function byId(id){return allKnown().find(t=>String(t?.id)===String(id))||null;}
  function woValue(t){return text(first(t,['wo_number','wo_no','work_order_number','work_order_no','wo','number','ticket_no','ticket_number'])).toUpperCase();}

  function resolveTicket(card){
    if(!card)return null;
    const ids=[];
    ['ticketId','id','ticket'].forEach(k=>{if(card.dataset?.[k])ids.push(card.dataset[k]);});
    card.querySelectorAll('[data-ticket-id],[data-id],[data-ticket]').forEach(el=>{const v=el.dataset?.ticketId||el.dataset?.id||el.dataset?.ticket;if(v)ids.push(v);});
    for(const id of ids){const t=byId(id);if(t)return t;}
    for(const el of card.querySelectorAll('[onclick]')){
      const code=text(el.getAttribute('onclick'));
      let m=code.match(/(?:openAssignModal|exportTicketPDF|deleteTicket|openPhotoModal|showTicket|openTicket|openRemarks)\(\s*['\"]([^'\"]+)['\"]/i);
      if(!m)m=code.match(/\(\s*['\"]([0-9a-f-]{8,})['\"]/i);
      if(m){const t=byId(m[1]);if(t)return t;}
    }
    const cardText=text(card.textContent).toUpperCase();
    const woMatch=cardText.match(/WO-\d{4}-\d{4,}/);
    if(woMatch){const wanted=woMatch[0];const t=allKnown().find(row=>woValue(row)===wanted);if(t)return t;}
    return null;
  }

  function sourceOf(t){return archiveTickets().some(x=>String(x?.id)===String(t?.id))?'archive':'active';}
  function row(label,value,wide=false){const v=text(value)||'-';return `<div style="${wide?'grid-column:1/-1;':''}min-width:0"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#777);margin-bottom:3px">${esc(label)}</div><div style="font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere">${esc(v)}</div></div>`;}

  function ticketFields(t){
    return {
      wo:first(t,['wo_number','wo_no','work_order_number','work_order_no','wo','number','ticket_number','ticket_no','code']),
      so:first(t,['so_number','sales_order_number','source_so_number','sales_order_no','so_no','source_so','sales_order']),
      project:first(t,['project_name','project','title','subject']),
      customer:first(t,['customer_name','customer','client_name','client']),
      phone:first(t,['customer_phone','phone','phone_number','contact_phone','whatsapp']),
      location:first(t,['location','address','customer_address','site_address','alamat']),
      desc:first(t,['description','desc','problem','issue','work_description','notes']),
      remarks:first(t,['technician_remarks','remarks']),
      status:first(t,['status']),
      tech1:first(t,['technician_name','technician','assigned_to_name','assigned_to','technician_1_name','technician1_name']),
      tech2:first(t,['technician2_name','technician_2_name','technician2','assigned_to_2_name','assigned_to2_name','technician_2']),
      date:first(t,['worked_at','work_date','scheduled_at','scheduled_date','date','created_at']),
      created:first(t,['created_at']),
      requester:first(t,['created_by_name','created_by','requester_name','requester']),
      maps:first(t,['maps_url','map_url','google_maps_url','location_url'])
    };
  }

  function detailHtml(t){
    const f=ticketFields(t);
    return `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px">${row('No. WO / Tiket',f.wo)}${row('Status',f.status)}${f.so?row('No. Sales Order',f.so,true):''}${row('Project / Pekerjaan',f.project,true)}${row('Customer',f.customer)}${row('Nomor Telepon',f.phone)}${row('Lokasi',f.location,true)}${row('Tanggal Pekerjaan',prettyDate(f.date))}${row('Dibuat',prettyDate(f.created))}${row('Teknisi 1',f.tech1)}${row('Teknisi 2',f.tech2)}${row('Dibuat / Dilaporkan Oleh',f.requester,true)}${row('Deskripsi / Informasi Pekerjaan',f.desc,true)}${row('Remarks Teknisi',f.remarks,true)}${f.maps?`<div style="grid-column:1/-1"><a href="${esc(f.maps)}" target="_blank" rel="noopener" class="btn sm">📍 Buka Google Maps</a></div>`:''}</div>`;
  }

  function whatsappText(t){
    const f=ticketFields(t);
    const tech=[text(f.tech1),text(f.tech2)].filter(Boolean);
    const techLine=tech.length>1?`👥 ${tech[0]} & ${tech[1]}`:tech.length?`👥 ${tech[0]}`:'👥 Belum Ditugaskan';
    const lines=[`Report Teknisi, ${reportDate(f.date)}.`,text(f.wo)||'WO -'];
    if(text(f.so))lines.push(text(f.so));
    lines.push(techLine,`📁 ${text(f.project)||'-'}.`,`Status: ${titleCase(f.status)||'-'}`);
    return lines.join('\n');
  }

  async function copyText(value){
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return true;}catch(_){}}
    const ta=document.createElement('textarea');ta.value=value;ta.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch(_){ok=false;}ta.remove();return ok;
  }

  function ensureModal(){
    let modal=document.getElementById('pxl-0038-ticket-detail-modal');
    if(modal)return modal;
    modal=document.createElement('div');modal.id='pxl-0038-ticket-detail-modal';modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:100002;align-items:center;justify-content:center;padding:14px;overflow:auto';
    modal.innerHTML=`<div style="width:min(720px,100%);max-height:92vh;overflow:auto;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:12px;box-shadow:0 16px 45px rgba(0,0,0,.22)"><div style="position:sticky;top:0;background:var(--surface,#fff);z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid var(--border,#e5e5e5)"><div><div style="font-size:16px;font-weight:700">Detail Work Order</div><div id="pxl-0038-sub" style="font-size:11px;color:var(--muted,#777);margin-top:2px"></div></div><button type="button" class="btn sm" id="pxl-0038-close">Tutup</button></div><div id="pxl-0038-body" style="padding:17px"></div><div style="position:sticky;bottom:0;background:var(--surface,#fff);display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 17px;border-top:1px solid var(--border,#e5e5e5)"><button type="button" class="btn" id="pxl-0038-wa">📋 Copy to WhatsApp</button><button type="button" class="btn" id="pxl-0038-pdf">📄 Download PDF</button><button type="button" class="btn primary" id="pxl-0038-done">Selesai</button></div></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.style.display='none';
    modal.querySelector('#pxl-0038-close').onclick=close;modal.querySelector('#pxl-0038-done').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.querySelector('#pxl-0038-pdf').onclick=()=>{const id=modal.dataset.ticketId,source=modal.dataset.source||'active';if(typeof window.exportTicketPDF==='function')window.exportTicketPDF(id,source);else alert('Fungsi PDF belum tersedia.');};
    modal.querySelector('#pxl-0038-wa').onclick=async()=>{
      const ticket=byId(modal.dataset.ticketId);if(!ticket)return alert('Work Order tidak ditemukan.');
      const btn=modal.querySelector('#pxl-0038-wa');const old=btn.textContent;btn.disabled=true;
      const ok=await copyText(whatsappText(ticket));btn.textContent=ok?'✅ Tersalin':'⚠️ Gagal Copy';setTimeout(()=>{btn.disabled=false;btn.textContent=old;},1400);
    };
    return modal;
  }

  function openTicketDetail(ticket){
    if(!ticket)return alert('Detail Work Order tidak ditemukan.');
    const modal=ensureModal();modal.dataset.ticketId=String(ticket.id);modal.dataset.source=sourceOf(ticket);modal.querySelector('#pxl-0038-body').innerHTML=detailHtml(ticket);modal.querySelector('#pxl-0038-sub').textContent=text(first(ticket,['wo_number','wo_no','number','ticket_number']))||'Informasi tiket';modal.style.display='flex';
  }

  function installButtons(){
    document.querySelectorAll('.ticket-item').forEach(card=>{
      const actions=card.querySelector('.ticket-actions');if(!actions)return;const ticket=resolveTicket(card);if(!ticket)return;
      let btn=actions.querySelector('.pxl-0038-detail-btn');
      if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn sm pxl-0038-detail-btn';btn.textContent='🔎 Detail';btn.style.cssText='min-width:0';const photo=[...actions.querySelectorAll('button,a')].find(el=>/Foto/i.test(text(el.textContent)));if(photo)photo.insertAdjacentElement('afterend',btn);else actions.appendChild(btn);}
      btn.dataset.ticketId=String(ticket.id);
    });
  }

  document.addEventListener('click',e=>{const btn=e.target?.closest?.('.pxl-0038-detail-btn');if(!btn)return;const ticket=byId(btn.dataset.ticketId)||resolveTicket(btn.closest('.ticket-item'));if(!ticket)return;e.preventDefault();e.stopImmediatePropagation();openTicketDetail(ticket);},true);
  let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(installButtons,80);};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',installButtons);setTimeout(installButtons,0);setTimeout(installButtons,300);setTimeout(installButtons,1000);setInterval(installButtons,5000);
  window.PXL_URG_0038={revision:REV,refresh:installButtons,open:id=>openTicketDetail(byId(id)),whatsappText:id=>{const t=byId(id);return t?whatsappText(t):'';}};
})();
